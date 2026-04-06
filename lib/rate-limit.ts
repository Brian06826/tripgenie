/**
 * Redis-based rate limiter using INCR + EXPIRE.
 * Falls back to in-memory rate limiting when REDIS_URL is not set (local dev).
 */

let redisClient: any = null

async function getRedis() {
  if (!redisClient) {
    const Redis = (await import('ioredis')).default
    redisClient = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    })
    await redisClient.connect()
  }
  return redisClient
}

// In-memory fallback for local dev (no Redis)
const memoryMap = new Map<string, number[]>()

async function checkMemory(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const timestamps = memoryMap.get(key) ?? []
  const recent = timestamps.filter(t => now - t < windowMs)
  if (recent.length >= limit) return true
  recent.push(now)
  memoryMap.set(key, recent)
  if (memoryMap.size > 1000) {
    for (const [k, ts] of memoryMap) {
      if (ts.every(t => now - t > windowMs)) memoryMap.delete(k)
    }
  }
  return false
}

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  en: 'Too many requests. Please try again in a few minutes.',
  'zh-TW': '請求太頻繁，請稍後再試。',
  'zh-HK': '請求太頻繁，請稍後再試。',
  'zh-CN': '请求太频繁，请稍后再试。',
}

/** Return a 429 Response with a localized rate-limit message. */
export function rateLimitResponse(language?: string): Response {
  const msg = RATE_LIMIT_MESSAGES[language ?? 'en'] ?? RATE_LIMIT_MESSAGES.en
  return Response.json({ error: msg }, { status: 429 })
}

/**
 * Check if a key is rate limited.
 * @param key   Unique key (e.g. "gen:1.2.3.4" or "edit:1.2.3.4")
 * @param limit Max requests allowed in window
 * @param windowSeconds Window size in seconds
 * @returns true if rate limited (should return 429)
 */
export async function isRateLimited(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!process.env.REDIS_URL) {
    return checkMemory(key, limit, windowSeconds * 1000)
  }

  try {
    const redis = await getRedis()
    const redisKey = `rl:${key}`
    const count = await redis.incr(redisKey)
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds)
    }
    return count > limit
  } catch (err) {
    console.error('Rate limit Redis error, falling back to allow:', err)
    return false
  }
}
