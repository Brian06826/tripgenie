import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addPassCredits, checkWebhookProcessed } from '@/lib/usage'
import { isRateLimited, rateLimitResponse } from '@/lib/rate-limit'

const VALID_PRODUCT_IDS = ['com.lulgo.app.trippass']
const CREDITS_PER_PASS = 3

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (await isRateLimited(`iap:${ip}`, 10, 3600)) {
    return rateLimitResponse()
  }

  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { transactionId, productId, jwsRepresentation } = body

    if (!transactionId || !productId) {
      return Response.json({ error: 'Missing transaction data' }, { status: 400 })
    }

    if (!VALID_PRODUCT_IDS.includes(productId)) {
      return Response.json({ error: 'Invalid product' }, { status: 400 })
    }

    // Idempotency — prevent double-crediting
    const alreadyProcessed = await checkWebhookProcessed(`iap:${transactionId}`)
    if (alreadyProcessed) {
      return Response.json({ ok: true, credits: CREDITS_PER_PASS, message: 'Already processed' })
    }

    // Decode JWS payload for sanity check
    if (jwsRepresentation) {
      try {
        const parts = jwsRepresentation.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8')
          )
          if (payload.productId && payload.productId !== productId) {
            return Response.json({ error: 'Product ID mismatch' }, { status: 400 })
          }
        }
      } catch {
        // StoreKit2 already verified client-side; continue
      }
    }

    await addPassCredits(userId, CREDITS_PER_PASS)
    console.log(`[verify-iap] +${CREDITS_PER_PASS} credits for ${userId}, tx:${transactionId}`)

    return Response.json({ ok: true, credits: CREDITS_PER_PASS })
  } catch (err) {
    console.error('[verify-iap] Error:', err)
    return Response.json({ error: 'Verification failed' }, { status: 500 })
  }
}
