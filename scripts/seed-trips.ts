/**
 * Seed trips for SEO landing pages.
 * Generates 10 popular-destination trips using the same pipeline as /api/generate.
 *
 * Run: npx tsx -r tsconfig-paths/register scripts/seed-trips.ts
 *
 * Requires:
 *   - ANTHROPIC_API_KEY (Claude generation)
 *   - REDIS_URL (trip storage)
 *   - GOOGLE_MAPS_API_KEY (geocoding + restaurant validation)
 *   - UNSPLASH_ACCESS_KEY (hero images, optional)
 */

import { nanoid } from 'nanoid'
import { generateTrip, deduplicatePlaces, backfillSpareDays } from '../lib/claude'
import { clampLateTimes, sortPlacesByTime } from '../lib/edit-trip'
import { saveTrip } from '../lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '../lib/url-helpers'
import { validateRestaurants, geocodeAllPlaces } from '../lib/google-places'
import { optimizeRoutes } from '../lib/route-optimizer'
import { fetchHeroImage } from '../lib/unsplash'
import type { Trip } from '../lib/types'

// ── Seed destinations ──────────────────────────────────────────────
const SEEDS = [
  { prompt: '東京 5日自由行，想去淺草、秋葉原、新宿、澀谷、築地', lang: 'zh-HK' },
  { prompt: '首爾 4日行程，明洞、景福宮、弘大、北村韓屋村', lang: 'zh-HK' },
  { prompt: '台北 4日旅行，九份、西門町、士林夜市、中正紀念堂', lang: 'zh-TW' },
  { prompt: '曼谷 5日行程，大皇宮、恰圖恰市場、考山路、水上市場', lang: 'zh-HK' },
  { prompt: '新加坡 3日遊，濱海灣、聖淘沙、牛車水、小印度', lang: 'zh-HK' },
  { prompt: '大阪 4日自由行，道頓堀、大阪城、環球影城、心齋橋', lang: 'zh-HK' },
  { prompt: '峇里島 5日度假行程，烏布、海神廟、庫塔海灘、梯田', lang: 'zh-HK' },
  { prompt: '香港 3日行程，太平山、尖沙咀、廟街、大澳', lang: 'zh-HK' },
  { prompt: '5-day London trip, Big Ben, Tower Bridge, Camden Market, Notting Hill', lang: 'en' },
  { prompt: '5-day Paris itinerary, Eiffel Tower, Louvre, Montmartre, Le Marais', lang: 'en' },
]

const DELAY_MS = 30_000 // 30 seconds between each generation

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function addUrls(days: Trip['days'], destination: string): Trip['days'] {
  return days.map(day => ({
    ...day,
    places: day.places.map(place => ({
      ...place,
      googleMapsUrl: buildGoogleMapsUrl(place.name, destination),
      googleReviewsUrl: buildGoogleReviewsUrl(place.name, destination),
      yelpUrl: buildYelpUrl(place.name, destination),
      backupOptions: place.backupOptions?.map(b => ({
        ...b,
        googleMapsUrl: buildGoogleMapsUrl(b.name, destination),
        yelpUrl: buildYelpUrl(b.name, destination),
      })),
    })),
  }))
}

// ── Main pipeline (mirrors /api/generate) ──────────────────────────

async function generateSeedTrip(prompt: string, index: number): Promise<string> {
  const label = `[${index + 1}/${SEEDS.length}]`
  console.log(`${label} 生成中... "${prompt}"`)

  const t0 = Date.now()

  // 1. Generate trip with Claude
  const generation = await generateTrip(prompt, (event) => {
    if (event.type === 'day') {
      console.log(`${label}   Day ${event.dayNumber}/${event.totalDays}`)
    }
  })
  console.log(`${label}   generateTrip: ${Date.now() - t0}ms`)

  // 2. Clamp late times + sort
  clampLateTimes(generation)
  sortPlacesByTime(generation)

  const tripId = nanoid(8)

  // 3. Validate restaurants against Google Places
  const t1 = Date.now()
  let validated = deduplicatePlaces(await validateRestaurants(generation))
  console.log(`${label}   validateRestaurants + dedup: ${Date.now() - t1}ms`)

  // 4. Backfill sparse days
  const t2 = Date.now()
  validated = await backfillSpareDays(validated)
  clampLateTimes(validated)
  sortPlacesByTime(validated)
  console.log(`${label}   backfillSpareDays: ${Date.now() - t2}ms`)

  // 5. Geocode + optimize routes
  const t3 = Date.now()
  const geocoded = await geocodeAllPlaces(validated)
  const optimized = optimizeRoutes(validated, geocoded)
  console.log(`${label}   geocode + optimize: ${Date.now() - t3}ms`)

  // 6. Build final trip with URLs
  const trip: Trip = {
    ...optimized,
    id: tripId,
    createdAt: new Date().toISOString(),
    validated: true,
    days: addUrls(optimized.days as Trip['days'], optimized.destination),
  }

  // 7. Fetch hero image
  try {
    const heroResult = await fetchHeroImage(optimized.destination)
    if (heroResult) {
      trip.heroImageUrl = heroResult.imageUrl
      trip.heroImageCredit = heroResult.credit
    }
  } catch (err) {
    console.log(`${label}   ⚠ Hero image failed, skipping`)
  }

  // 8. Save to Redis
  await saveTrip(tripId, trip)

  const totalMs = Date.now() - t0
  const places = trip.days.reduce((sum, d) => sum + d.places.length, 0)
  console.log(`${label} ✓ 完成！ ID: ${tripId} | ${trip.days.length} days, ${places} places | ${(totalMs / 1000).toFixed(1)}s`)
  console.log(`${label}   → /trip/${tripId}`)

  return tripId
}

// ── Run ────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║   Lulgo Seed Trip Generator            ║')
  console.log(`║   ${SEEDS.length} destinations, sequential       ║`)
  console.log('╚════════════════════════════════════════╝')
  console.log()

  const results: { prompt: string; tripId?: string; error?: string }[] = []

  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i]

    try {
      const tripId = await generateSeedTrip(seed.prompt, i)
      results.push({ prompt: seed.prompt, tripId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${i + 1}/${SEEDS.length}] ✗ 失敗: ${msg}`)
      results.push({ prompt: seed.prompt, error: msg })
    }

    // Wait 30s before next one (skip delay after last)
    if (i < SEEDS.length - 1) {
      console.log(`\n⏳ 等待 ${DELAY_MS / 1000}s 再繼續...\n`)
      await sleep(DELAY_MS)
    }
  }

  // Summary
  console.log('\n╔════════════════════════════════════════╗')
  console.log('║   完成！Summary                        ║')
  console.log('╚════════════════════════════════════════╝')

  const ok = results.filter(r => r.tripId)
  const fail = results.filter(r => r.error)

  console.log(`✓ 成功: ${ok.length}/${SEEDS.length}`)
  if (fail.length > 0) console.log(`✗ 失敗: ${fail.length}/${SEEDS.length}`)
  console.log()

  for (const r of results) {
    const status = r.tripId ? `✓ /trip/${r.tripId}` : `✗ ${r.error}`
    console.log(`  ${status}  ← ${r.prompt.slice(0, 40)}`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
