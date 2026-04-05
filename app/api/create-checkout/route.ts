import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  let userId: string | undefined
  try {
    const session = await getServerSession(authOptions)
    userId = (session?.user as any)?.id as string | undefined
  } catch (err) {
    console.error('Session error in create-checkout:', err)
  }

  // Trip Pass requires sign-in so credits persist across devices
  if (!userId) {
    return Response.json({ error: 'sign_in_required' }, { status: 401 })
  }

  try {
    const origin = request.headers.get('origin') ?? process.env.NEXTAUTH_URL ?? 'https://lulgo.com'

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Trip Pass',
              description: '3 extra trip generations + longer trips (up to 14 days)',
            },
            unit_amount: 299, // $2.99
          },
          quantity: 1,
        },
      ],
      metadata: {
        uid: userId,
        credits: '3',
      },
      success_url: `${origin}?payment=success`,
      cancel_url: `${origin}?payment=cancel`,
    })

    return Response.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: 'checkout_failed', detail: message }, { status: 500 })
  }
}
