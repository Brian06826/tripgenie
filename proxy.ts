import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Module-level singleton — instantiated once, not per-request.
// Only created when KV is configured (production); skipped in local dev.
let ratelimit: import('@upstash/ratelimit').Ratelimit | null = null

async function getRatelimit() {
  if (!process.env.KV_REST_API_URL) return null
  if (ratelimit) return ratelimit
  const { Ratelimit } = await import('@upstash/ratelimit')
  const { kv } = await import('@vercel/kv')
  ratelimit = new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: false,
  })
  return ratelimit
}

export async function proxy(req: NextRequest) {
  const rl = await getRatelimit()
  if (!rl) return NextResponse.next()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'anonymous'

  const { success, limit, remaining } = await rl.limit(ip)

  if (!success) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please wait before generating another itinerary. / 請求次數過多，請稍後再試。',
        limit,
        remaining: 0,
      },
      { status: 429 }
    )
  }

  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(limit))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  return response
}

export const config = {
  matcher: '/api/generate',
}
