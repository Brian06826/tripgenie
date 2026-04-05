import Stripe from 'stripe'
import { addPassCredits, checkWebhookProcessed } from '@/lib/usage'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _stripe
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Idempotency: skip if already processed
    const alreadyProcessed = await checkWebhookProcessed(session.id)
    if (alreadyProcessed) {
      console.log(`[Webhook] Already processed session ${session.id}, skipping`)
      return Response.json({ received: true })
    }

    const uid = session.metadata?.uid
    const credits = parseInt(session.metadata?.credits ?? '3', 10)

    if (!uid) {
      console.error('[Webhook] Missing uid in session metadata:', session.id)
      return Response.json({ error: 'Missing uid' }, { status: 400 })
    }

    await addPassCredits(uid, credits)
    console.log(`[Webhook] Added ${credits} credits to ${uid} (session: ${session.id})`)
  }

  return Response.json({ received: true })
}
