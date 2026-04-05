import type { MetadataRoute } from 'next'
import { EXAMPLE_TRIPS } from '@/lib/example-trips'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // re-generate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://lulgo.com'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'monthly', priority: 0.2 },
  ]

  // Example trips (always available)
  const examplePages: MetadataRoute.Sitemap = Object.keys(EXAMPLE_TRIPS).map(id => ({
    url: `${base}/trip/${id}`,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // User-generated trips from Redis
  let userTripPages: MetadataRoute.Sitemap = []
  try {
    if (process.env.REDIS_URL) {
      const Redis = (await import('ioredis')).default
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 5000,
        tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
      })
      await redis.connect()
      const keys = await redis.keys('trip:*')
      await redis.quit()

      userTripPages = keys.map(key => ({
        url: `${base}/trip/${key.replace('trip:', '')}`,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }
  } catch (err) {
    console.error('Sitemap: failed to fetch trip keys from Redis', err)
  }

  return [...staticPages, ...examplePages, ...userTripPages]
}
