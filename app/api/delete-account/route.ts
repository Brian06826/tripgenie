import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserTripIds } from '@/lib/storage'
import { isRateLimited, rateLimitResponse } from '@/lib/rate-limit'

export async function DELETE(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (await isRateLimited(`delete-account:${ip}`, 3, 3600)) {
    return rateLimitResponse()
  }

  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined

    if (!userId) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Delete all user data from Redis
    if (process.env.REDIS_URL) {
      const Redis = (await import('ioredis')).default
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
      })
      await redis.connect()

      try {
        // 1. Get all user's trip IDs
        const tripIds = await getUserTripIds(userId)

        // 2. Build list of keys to delete
        const keysToDelete: string[] = []

        // Trip data
        for (const tripId of tripIds) {
          keysToDelete.push(`trip:${tripId}`)
        }

        // User trip index
        keysToDelete.push(`user-trips:${userId}`)

        // Pass credits
        keysToDelete.push(`pass:${userId}`)

        // Monthly usage keys (current + last 3 months)
        const now = new Date()
        for (let i = 0; i < 4; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          keysToDelete.push(`usage:${userId}:${monthKey}`)
        }

        // 3. Delete all keys
        if (keysToDelete.length > 0) {
          await redis.del(...keysToDelete)
        }

        console.log(`[delete-account] Deleted ${keysToDelete.length} keys for user ${userId}`)
      } finally {
        await redis.quit()
      }
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[delete-account] Error:', err)
    return Response.json({ error: 'Deletion failed' }, { status: 500 })
  }
}
