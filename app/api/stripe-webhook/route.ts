import Stripe from 'stripe'
import { addPassCredits, checkWebhookProcessed } from '@/lib/usage'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim())
  }
  return _stripe
}

export async function POST(request: Request) {
  console.log('[Webhook] Received request')

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Webhook] Missing env vars:', {
      hasKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    })
    return Response.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header')
    return Response.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!.trim()
    )
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[Webhook] Event: ${event.type} (${event.id})`)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    console.log(`[Webhook] Session ${session.id}, metadata:`, session.metadata)

    // Idempotency: skip if already processed
    const alreadyProcessed = await checkWebhookProcessed(session.id)
    if (alreadyProcessed) {
      console.log(`[Webhook] Already processed session ${session.id}, skipping`)
      return Response.json({ received: true })
    }

    const uid = session.metadata?.uid
    const credits = parseInt(session.metadata?.credits ?? '3', 10)

    if (!uid) {
      console.error(`[Webhook] Missing uid in session metadata: ${session.id}`)
      return Response.json({ error: 'Missing uid' }, { status: 400 })
    }

    await addPassCredits(uid, credits)
    console.log(`[Webhook] Added ${credits} credits to uid=${uid} (session: ${session.id})`)
  }

  return Response.json({ received: true })
}
