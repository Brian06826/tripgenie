/**
 * Seed trips for SEO landing pages.
 * Generates trips for popular destinations using the same pipeline as /api/generate.
 *
 * Run: source <(grep -v '^#' .env.local | sed 's/^/export /') && npx tsx scripts/seed-trips.ts
 *
 * Options:
 *   --skip-existing   Skip destinations that already have a seed trip in Redis
 *   --only-new        Alias for --skip-existing
 *   --dry-run         Show what would be generated without actually doing it
 *
 * Requires:
 *   - ANTHROPIC_API_KEY (Claude generation)
 *   - REDIS_URL (trip storage)
 *   - GOOGLE_PLACES_API_KEY (geocoding + restaurant validation)
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

type Seed = { prompt: string; lang: string; destination: string }

const SEEDS: Seed[] = [
  // ── Original 10 ──
  { prompt: '東京 5日自由行，想去淺草、秋葉原、新宿、澀谷、築地', lang: 'zh-HK', destination: 'Tokyo' },
  { prompt: '首爾 4日行程，明洞、景福宮、弘大、北村韓屋村', lang: 'zh-HK', destination: 'Seoul' },
  { prompt: '台北 4日旅行，九份、西門町、士林夜市、中正紀念堂', lang: 'zh-TW', destination: 'Taipei' },
  { prompt: '曼谷 5日行程，大皇宮、恰圖恰市場、考山路、水上市場', lang: 'zh-HK', destination: 'Bangkok' },
  { prompt: '新加坡 3日遊，濱海灣、聖淘沙、牛車水、小印度', lang: 'zh-HK', destination: 'Singapore' },
  { prompt: '大阪 4日自由行，道頓堀、大阪城、環球影城、心齋橋', lang: 'zh-HK', destination: 'Osaka' },
  { prompt: '峇里島 5日度假行程，烏布、海神廟、庫塔海灘、梯田', lang: 'zh-HK', destination: 'Bali' },
  { prompt: '香港 3日行程，太平山、尖沙咀、廟街、大澳', lang: 'zh-HK', destination: 'Hong Kong' },
  { prompt: '5-day London trip, Big Ben, Tower Bridge, Camden Market, Notting Hill', lang: 'en', destination: 'London' },
  { prompt: '5-day Paris itinerary, Eiffel Tower, Louvre, Montmartre, Le Marais', lang: 'en', destination: 'Paris' },

  // ── New 15 ──
  { prompt: '5-day New York City trip, Times Square, Central Park, Brooklyn Bridge, SoHo, Chinatown', lang: 'en', destination: 'New York' },
  { prompt: '京都 3日行程，清水寺、伏見稻荷、嵐山竹林、金閣寺', lang: 'zh-HK', destination: 'Kyoto' },
  { prompt: '清邁 4日行程，古城、夜間動物園、素帖山、週日夜市', lang: 'zh-HK', destination: 'Chiang Mai' },
  { prompt: '胡志明市 4日行程，戰爭遺跡博物館、濱城市場、范五老街、古芝地道', lang: 'zh-HK', destination: 'Ho Chi Minh City' },
  { prompt: '5-day Sydney trip, Opera House, Bondi Beach, The Rocks, Darling Harbour, Blue Mountains', lang: 'en', destination: 'Sydney' },
  { prompt: '4-day Rome itinerary, Colosseum, Vatican, Trevi Fountain, Trastevere, Pantheon', lang: 'en', destination: 'Rome' },
  { prompt: '4-day Barcelona trip, Sagrada Familia, Park Güell, La Rambla, Gothic Quarter, La Boqueria', lang: 'en', destination: 'Barcelona' },
  { prompt: '4-day Istanbul itinerary, Hagia Sophia, Grand Bazaar, Blue Mosque, Bosphorus cruise, Spice Market', lang: 'en', destination: 'Istanbul' },
  { prompt: '4-day Melbourne trip, Laneways, Great Ocean Road day trip, Queen Victoria Market, Fitzroy, St Kilda', lang: 'en', destination: 'Melbourne' },
  { prompt: '濟州島 3日行程，城山日出峰、萬丈窟、東門市場、牛島', lang: 'zh-HK', destination: 'Jeju' },
  { prompt: '河內 4日行程，還劍湖、三十六行街、河內大教堂、下龍灣一日遊', lang: 'zh-HK', destination: 'Hanoi' },
  { prompt: '福岡 3日行程，天神、中洲屋台、太宰府天滿宮、博多運河城', lang: 'zh-HK', destination: 'Fukuoka' },
  { prompt: '沖繩 4日行程，首里城、美麗海水族館、國際通、萬座毛、美國村', lang: 'zh-HK', destination: 'Okinawa' },
  { prompt: '3-day Prague trip, Old Town Square, Charles Bridge, Prague Castle, Petrin Hill, Vltava River', lang: 'en', destination: 'Prague' },
  { prompt: '3-day Amsterdam itinerary, Rijksmuseum, Anne Frank House, Jordaan, Vondelpark, canal cruise', lang: 'en', destination: 'Amsterdam' },
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

// ── Skip-existing check ───────────────────────────────────────────

async function getExistingDestinations(): Promise<Set<string>> {
  if (!process.env.REDIS_URL) return new Set()

  const Redis = (await import('ioredis')).default
  const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  })
  await redis.connect()

  const keys = await redis.keys('trip:*')
  const existing = new Set<string>()

  // Check in batches of 50
  for (let i = 0; i < keys.length; i += 50) {
    const batch = keys.slice(i, i + 50)
    const values = await redis.mget(batch)
    for (const raw of values) {
      if (!raw) continue
      try {
        const trip = JSON.parse(raw)
        if (trip.destination) {
          // Normalize: lowercase, trim
          existing.add(trip.destination.toLowerCase().trim())
        }
      } catch {}
    }
  }

  await redis.quit()
  return existing
}

function destinationExists(existing: Set<string>, destination: string): boolean {
  const norm = destination.toLowerCase().trim()
  // Check exact match and common variations
  for (const d of existing) {
    if (d === norm) return true
    if (d.includes(norm) || norm.includes(d)) return true
  }
  return false
}

// ── Main pipeline (mirrors /api/generate) ──────────────────────────

async function generateSeedTrip(seed: Seed, index: number, total: number): Promise<string> {
  const label = `[${index + 1}/${total}]`
  console.log(`${label} 生成中... "${seed.prompt}"`)

  const t0 = Date.now()

  // 1. Generate trip with Claude
  const generation = await generateTrip(seed.prompt, undefined, (event) => {
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
  const args = process.argv.slice(2)
  const skipExisting = args.includes('--skip-existing') || args.includes('--only-new')
  const dryRun = args.includes('--dry-run')

  let seeds = SEEDS

  if (skipExisting) {
    console.log('Checking existing trips in Redis...')
    const existing = await getExistingDestinations()
    console.log(`Found ${existing.size} unique destinations in Redis`)

    const before = seeds.length
    seeds = seeds.filter(s => !destinationExists(existing, s.destination))
    const skipped = before - seeds.length
    if (skipped > 0) {
      console.log(`Skipping ${skipped} destinations that already exist`)
    }
  }

  if (seeds.length === 0) {
    console.log('All destinations already exist. Nothing to generate.')
    return
  }

  console.log()
  console.log('╔════════════════════════════════════════╗')
  console.log('║   Lulgo Seed Trip Generator            ║')
  console.log(`║   ${seeds.length} destinations to generate       ║`)
  console.log('╚════════════════════════════════════════╝')
  console.log()

  if (dryRun) {
    console.log('DRY RUN — would generate:')
    for (const s of seeds) {
      console.log(`  • ${s.destination}: "${s.prompt.slice(0, 50)}..."`)
    }
    return
  }

  const results: { prompt: string; destination: string; tripId?: string; error?: string }[] = []

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]

    try {
      const tripId = await generateSeedTrip(seed, i, seeds.length)
      results.push({ prompt: seed.prompt, destination: seed.destination, tripId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${i + 1}/${seeds.length}] ✗ 失敗: ${msg}`)
      results.push({ prompt: seed.prompt, destination: seed.destination, error: msg })
    }

    // Wait 30s before next one (skip delay after last)
    if (i < seeds.length - 1) {
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

  console.log(`✓ 成功: ${ok.length}/${seeds.length}`)
  if (fail.length > 0) console.log(`✗ 失敗: ${fail.length}/${seeds.length}`)
  console.log()

  for (const r of results) {
    const status = r.tripId ? `✓ /trip/${r.tripId}` : `✗ ${r.error}`
    console.log(`  ${status}  ← ${r.destination}`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
