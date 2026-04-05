import Stripe from 'stripe'
import { addPassCredits, checkWebhookProcessed } from '@/lib/usage'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim())
  }
  return _stripe
}

/**
 * Client-side fallback: verify a Stripe checkout session after redirect.
 * Called when user lands on ?payment=success&session_id=cs_xxx.
 * Uses the same idempotency guard as the webhook so credits are only added once.
 */
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  let body: { session_id?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const sessionId = body.session_id?.trim()
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return Response.json({ error: 'Invalid session_id' }, { status: 400 })
  }

  try {
    // Retrieve the checkout session from Stripe
    const session = await getStripe().checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      console.log(`[verify-payment] Session ${sessionId} not paid: ${session.payment_status}`)
      return Response.json({ error: 'not_paid', status: session.payment_status }, { status: 400 })
    }

    const uid = session.metadata?.uid
    const credits = parseInt(session.metadata?.credits ?? '3', 10)

    if (!uid) {
      console.error(`[verify-payment] No uid in metadata for session ${sessionId}`)
      return Response.json({ error: 'no_uid' }, { status: 400 })
    }

    // Same idempotency as webhook — won't double-add
    const alreadyProcessed = await checkWebhookProcessed(sessionId)
    if (alreadyProcessed) {
      console.log(`[verify-payment] Already processed ${sessionId}, returning ok`)
      return Response.json({ ok: true, already: true })
    }

    await addPassCredits(uid, credits)
    console.log(`[verify-payment] Added ${credits} credits to ${uid} (session: ${sessionId})`)

    return Response.json({ ok: true, credits })
  } catch (err) {
    console.error('[verify-payment] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: 'verification_failed', detail: message }, { status: 500 })
  }
}
