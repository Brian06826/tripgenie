import { EXAMPLE_TRIPS } from '@/lib/example-trips'

export const dynamic = 'force-dynamic'

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://lulgo.com'

  const urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[] = []

  // Static pages
  urls.push({ loc: base, lastmod: new Date().toISOString().split('T')[0], changefreq: 'daily', priority: '1.0' })
  urls.push({ loc: `${base}/privacy`, changefreq: 'monthly', priority: '0.2' })
  urls.push({ loc: `${base}/terms`, changefreq: 'monthly', priority: '0.2' })

  // Example trips
  for (const id of Object.keys(EXAMPLE_TRIPS)) {
    urls.push({ loc: `${base}/trip/${id}`, changefreq: 'monthly', priority: '0.8' })
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
        urls.push({
          loc: `${base}/trip/${key.replace('trip:', '')}`,
          changefreq: 'weekly',
          priority: '0.6',
        })
      }
    }
  } catch (err) {
    console.error('Sitemap: failed to fetch trip keys from Redis', err)
  }

  // Build XML string
  const urlEntries = urls.map(u => {
    let entry = `  <url>\n    <loc>${u.loc}</loc>`
    if (u.lastmod) entry += `\n    <lastmod>${u.lastmod}</lastmod>`
    if (u.changefreq) entry += `\n    <changefreq>${u.changefreq}</changefreq>`
    if (u.priority) entry += `\n    <priority>${u.priority}</priority>`
    entry += `\n  </url>`
    return entry
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  })
}
