import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim())
  }
  return _stripe
}

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set')
    return Response.json({ error: 'stripe_not_configured', detail: 'Stripe key missing' }, { status: 500 })
  }

  let userId: string | undefined
  let sessionDebug: string = 'no_attempt'
  try {
    const session = await getServerSession(authOptions)
    sessionDebug = session ? `ok:${!!(session.user as any)?.id}` : 'null_session'
    userId = (session?.user as any)?.id as string | undefined
  } catch (err) {
    sessionDebug = `error:${err instanceof Error ? err.message : 'unknown'}`
    console.error('Session error in create-checkout:', err)
  }

  if (!userId) {
    console.log(`create-checkout: sign_in_required (session=${sessionDebug})`)
    return Response.json({ error: 'sign_in_required', debug: sessionDebug }, { status: 401 })
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
      success_url: `${origin}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?payment=cancel`,
    })

    return Response.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: 'checkout_failed', detail: message }, { status: 500 })
  }
}
