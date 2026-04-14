/**
 * Usage tracking + Trip Pass credit management.
 *
 * Free tier: 4 generates/month (anonymous via cookie UID, signed-in via userId)
 * Trip Pass: $2.99 for 3 extra generates, max 14-day trips, never expire
 *
 * Redis keys:
 *   usage:{uid}:{YYYY-MM}  — monthly generation count (TTL 60 days)
 *   pass:{uid}              — remaining Trip Pass credits (no TTL)
 *   webhook:{sessionId}     — idempotency guard (TTL 7 days)
 */

import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'

const FREE_LIMIT = 4
const FREE_MAX_DAYS = 7
const PASS_MAX_DAYS = 14
const COOKIE_NAME = 'lulgo_uid'

// ── UID helpers ──────────────────────────────────────────────────

/** Get or create an anonymous UID from httpOnly cookie */
export async function getOrCreateUID(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get(COOKIE_NAME)?.value
  if (existing) return existing

  const uid = nanoid(16)
  jar.set(COOKIE_NAME, uid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  })
  return uid
}

/** Resolve the effective UID: signed-in userId takes precedence over cookie */
export function resolveUID(userId: string | undefined, cookieUID: string): string {
  return userId ?? cookieUID
}

// ── Redis helpers ────────────────────────────────────────────────

let _redis: any = null

async function getRedis() {
  if (!_redis) {
    const Redis = (await import('ioredis')).default
    _redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    })
    await _redis.connect()
  }
  return _redis
}

function monthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── Usage check ──────────────────────────────────────────────────

export type UsageStatus = {
  allowed: boolean
  remaining: number
  hasPass: boolean
  passCredits: number
  maxDays: number
  reason?: 'limit_reached'
}

export async function checkUsage(uid: string): Promise<UsageStatus> {
  if (!process.env.REDIS_URL) {
    // Local dev: always allow
    return { allowed: true, remaining: FREE_LIMIT, hasPass: false, passCredits: 0, maxDays: PASS_MAX_DAYS }
  }

  try {
    const redis = await getRedis()
    const usageKey = `usage:${uid}:${monthKey()}`
    const passKey = `pass:${uid}`

    const [countStr, passStr] = await redis.mget(usageKey, passKey)
    const count = parseInt(countStr ?? '0', 10)
    const passCredits = parseInt(passStr ?? '0', 10)
    const hasPass = passCredits > 0

    if (count < FREE_LIMIT) {
      return {
        allowed: true,
        remaining: FREE_LIMIT - count,
        hasPass,
        passCredits,
        maxDays: hasPass ? PASS_MAX_DAYS : FREE_MAX_DAYS,
      }
    }

    // Free limit reached — check pass credits
    if (passCredits > 0) {
      return {
        allowed: true,
        remaining: 0,
        hasPass: true,
        passCredits,
        maxDays: PASS_MAX_DAYS,
      }
    }

    return {
      allowed: false,
      remaining: 0,
      hasPass: false,
      passCredits: 0,
      maxDays: FREE_MAX_DAYS,
      reason: 'limit_reached',
    }
  } catch (err) {
    console.error('Usage check error, allowing:', err)
    return { allowed: true, remaining: FREE_LIMIT, hasPass: false, passCredits: 0, maxDays: PASS_MAX_DAYS }
  }
}

// ── Record usage (called AFTER successful generation) ────────────

export async function recordUsage(uid: string): Promise<void> {
  if (!process.env.REDIS_URL) return

  try {
    const redis = await getRedis()
    const usageKey = `usage:${uid}:${monthKey()}`

    const count = await redis.incr(usageKey)
    if (count === 1) {
      // 60 days TTL so the key survives the full month + buffer
      await redis.expire(usageKey, 60 * 60 * 24 * 60)
    }

    // If over free limit, deduct a pass credit
    if (count > FREE_LIMIT) {
      const passKey = `pass:${uid}`
      const remaining = await redis.decr(passKey)
      if (remaining < 0) {
        // Shouldn't happen (we check before), but clamp to 0
        await redis.set(passKey, '0')
      }
    }
  } catch (err) {
    console.error('Record usage error:', err)
  }
}

// ── Pass credit management (called from webhook) ────────────────

export async function addPassCredits(uid: string, credits: number): Promise<void> {
  if (!process.env.REDIS_URL) return

  try {
    const redis = await getRedis()
    const passKey = `pass:${uid}`
    await redis.incrby(passKey, credits)
  } catch (err) {
    console.error('Add pass credits error:', err)
  }
}

/** Check webhook idempotency — returns true if already processed */
export async function checkWebhookProcessed(sessionId: string): Promise<boolean> {
  if (!process.env.REDIS_URL) return false

  try {
    const redis = await getRedis()
    const key = `webhook:${sessionId}`
    const result = await redis.set(key, '1', 'EX', 7 * 24 * 3600, 'NX')
    return result === null // null means key already existed
  } catch (err) {
    console.error('Webhook idempotency check error:', err)
    return false
  }
}

// ── Client-side API ──────────────────────────────────────────────

export async function getUsageForClient(uid: string): Promise<{
  used: number
  limit: number
  passCredits: number
  maxDays: number
}> {
  if (!process.env.REDIS_URL) {
    return { used: 0, limit: FREE_LIMIT, passCredits: 0, maxDays: PASS_MAX_DAYS }
  }

  try {
    const redis = await getRedis()
    const usageKey = `usage:${uid}:${monthKey()}`
    const passKey = `pass:${uid}`

    const [countStr, passStr] = await redis.mget(usageKey, passKey)
    const used = parseInt(countStr ?? '0', 10)
    const passCredits = parseInt(passStr ?? '0', 10)

    return {
      used,
      limit: FREE_LIMIT,
      passCredits,
      maxDays: passCredits > 0 ? PASS_MAX_DAYS : FREE_MAX_DAYS,
    }
  } catch (err) {
    console.error('Get usage for client error:', err)
    return { used: 0, limit: FREE_LIMIT, passCredits: 0, maxDays: PASS_MAX_DAYS }
  }
}
