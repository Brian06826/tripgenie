import { EXAMPLE_TRIPS } from '@/lib/example-trips'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type SitemapEntry = {
  url: string
  lastmod?: string
  changefreq?: string
  priority?: number
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://lulgo.com'

  const entries: SitemapEntry[] = [
    { url: base, lastmod: new Date().toISOString().split('T')[0], changefreq: 'daily', priority: 1.0 },
    { url: `${base}/privacy`, changefreq: 'monthly', priority: 0.2 },
    { url: `${base}/terms`, changefreq: 'monthly', priority: 0.2 },
  ]

  // Example trips
  for (const id of Object.keys(EXAMPLE_TRIPS)) {
    entries.push({ url: `${base}/trip/${id}`, changefreq: 'monthly', priority: 0.8 })
  }

  // User-generated trips from Redis
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

      for (const key of keys) {
        entries.push({
          url: `${base}/trip/${key.replace('trip:', '')}`,
          changefreq: 'weekly',
          priority: 0.6,
        })
      }
    }
  } catch (err) {
    console.error('Sitemap: failed to fetch trip keys from Redis', err)
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(e => [
      '  <url>',
      `    <loc>${escapeXml(e.url)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : '',
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : '',
      e.priority != null ? `    <priority>${e.priority}</priority>` : '',
      '  </url>',
    ].filter(Boolean).join('\n')),
    '</urlset>',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
