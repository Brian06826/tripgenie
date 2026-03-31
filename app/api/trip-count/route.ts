import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE_COUNT = 500

export async function GET() {
  try {
    if (!process.env.REDIS_URL) {
      return NextResponse.json({ count: BASE_COUNT })
    }
    const Redis = (await import('ioredis')).default
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 3000,
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    })
    await redis.connect()
    const keys = await redis.keys('trip:*')
    await redis.quit()
    return NextResponse.json({ count: BASE_COUNT + keys.length })
  } catch {
    return NextResponse.json({ count: BASE_COUNT })
  }
}
