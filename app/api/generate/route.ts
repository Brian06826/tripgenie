import { nanoid } from 'nanoid'
import { generateTrip } from '@/lib/claude'
import { saveTrip } from '@/lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '@/lib/url-helpers'
import { generateAndUploadOgImage } from '@/lib/og'
import { fetchHeroImage } from '@/lib/unsplash'
import { validateRestaurants, geocodeAllPlaces } from '@/lib/google-places'
import { optimizeRoutes } from '@/lib/route-optimizer'
import type { Trip } from '@/lib/types'

export const maxDuration = 300

// Simple in-memory rate limiter: 5 requests per minute per IP
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) ?? []
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  rateLimitMap.set(ip, recent)
  // Prevent memory leak: purge stale entries every 100 checks
  if (rateLimitMap.size > 1000) {
    for (const [key, ts] of rateLimitMap) {
      if (ts.every(t => now - t > RATE_WINDOW_MS)) rateLimitMap.delete(key)
    }
  }
  return false
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      { status: 429 }
    )
  }

  let body: { prompt?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  if (!prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400 })
  }
  if (prompt.length > 500) {
    return Response.json({ error: 'prompt too long (max 500 chars)' }, { status: 400 })
  }

  // Server-side trip validation — reject conversational messages before calling Claude
  const TRAVEL_RE = /\b(trip|day|days|night|nights|travel|vacation|holiday|itinerary|visit|tour|explore|weekend|getaway|sightseeing|road\s?trip|fly|flight|hotel|hostel|airbnb|resort|beach|hike|hiking)\b/i
  const TRAVEL_ZH = /(日|天|夜|晚|旅行|旅遊|遊|行程|玩|景點|酒店|民宿|海灘|自由行|跟團|出發|機票|住宿|觀光|度假|週末)/
  const DEST_RE = /\b(tokyo|osaka|kyoto|seoul|taipei|hong\s?kong|bangkok|singapore|paris|london|rome|new\s?york|nyc|los\s?angeles|la|san\s?francisco|sf|san\s?diego|sd|seattle|boston|miami|chicago|hawaii|maui|las\s?vegas|cancun|dubai|sydney|vancouver|toronto|long\s?beach|denver|austin|nashville|portland|orlando|atlanta|phoenix|houston)\b/i
  const DEST_ZH = /(東京|大阪|京都|首爾|台北|香港|曼谷|新加坡|巴黎|倫敦|紐約|洛杉磯|舊金山|三藩市|夏威夷|沖繩|上海|北京)/
  const DUR_RE = /\d+\s*[-–]?\s*(day|night|日|天|夜|晚)/i
  const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(prompt)
  const tooShort = prompt.length < (hasCJK ? 3 : 5)
  const hasSignal = TRAVEL_RE.test(prompt) || TRAVEL_ZH.test(prompt) || DEST_RE.test(prompt) || DEST_ZH.test(prompt) || DUR_RE.test(prompt)
  if (tooShort || !hasSignal) {
    return Response.json(
      { error: "Please describe a trip! Include a destination and how long. For example: '3 days Tokyo food trip' or '一日遊 Long Beach 情侶'" },
      { status: 400 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      send({ type: 'heartbeat' })
      const pulse = setInterval(() => { try { send({ type: 'heartbeat' }) } catch {} }, 5000)

      try {
        const generation = await generateTrip(prompt)

        const tripId = nanoid(8)

        // Build preview trip with URLs (no geocoding/optimization yet)
        const previewDays = generation.days.map(day => ({
          ...day,
          places: day.places.map(place => ({
            ...place,
            googleMapsUrl: buildGoogleMapsUrl(place.name, generation.destination),
            googleReviewsUrl: buildGoogleReviewsUrl(place.name, generation.destination),
            yelpUrl: buildYelpUrl(place.name, generation.destination),
            backupOptions: place.backupOptions?.map(b => ({
              ...b,
              googleMapsUrl: buildGoogleMapsUrl(b.name, generation.destination),
              yelpUrl: buildYelpUrl(b.name, generation.destination),
            })),
          })),
        }))

        const previewTrip: Trip = {
          ...generation,
          id: tripId,
          createdAt: new Date().toISOString(),
          validated: false,
          days: previewDays,
        }

        // Save preview and tell client to navigate immediately
        await saveTrip(tripId, previewTrip)
        send({ type: 'preview', tripId })

        // Validate restaurants against Google Places API
        send({ type: 'validating' })
        const validated = await validateRestaurants(generation)

        // Geocode all places and optimize routes per day
        send({ type: 'optimizing' })
        const geocoded = await geocodeAllPlaces(validated)
        const optimized = optimizeRoutes(validated, geocoded)

        const days = optimized.days.map(day => ({
          ...day,
          places: day.places.map(place => ({
            ...place,
            googleMapsUrl: buildGoogleMapsUrl(place.name, optimized.destination),
            googleReviewsUrl: buildGoogleReviewsUrl(place.name, optimized.destination),
            yelpUrl: buildYelpUrl(place.name, optimized.destination),
            backupOptions: place.backupOptions?.map(b => ({
              ...b,
              googleMapsUrl: buildGoogleMapsUrl(b.name, optimized.destination),
              yelpUrl: buildYelpUrl(b.name, optimized.destination),
            })),
          })),
        }))

        const trip: Trip = {
          ...optimized,
          id: tripId,
          createdAt: new Date().toISOString(),
          validated: true,
          days,
        }

        send({ type: 'saving' })

        // Save trip immediately so user can view it fast
        await saveTrip(tripId, trip)
        send({ type: 'done', tripId })

        // Generate hero + OG images in background, then update the saved trip
        Promise.all([
          fetchHeroImage(optimized.destination),
          generateAndUploadOgImage(trip),
        ]).then(async ([heroResult, ogImageUrl]) => {
          let updated = false
          if (heroResult) {
            trip.heroImageUrl = heroResult.imageUrl
            trip.heroImageCredit = heroResult.credit
            updated = true
          }
          if (ogImageUrl) {
            trip.ogImageUrl = ogImageUrl
            updated = true
          }
          if (updated) {
            await saveTrip(tripId, trip)
          }
        }).catch(err => {
          console.error('Background image generation failed:', err)
        })
      } catch (err) {
        console.error('Generation error:', err)
        const raw = err instanceof Error ? err.message : ''
        const isTimeout = raw.includes('timeout') || raw.includes('timed out') || raw.includes('Request timeout')
        const message = isTimeout
          ? 'Generation took too long — please try a shorter or simpler trip description.'
          : (raw.includes('Unable to generate') || raw.includes('rephrase') || raw.includes('Please describe') || raw.includes('too long')
              ? raw
              : 'Generation failed. Please try again.')
        send({ type: 'error', message })
      } finally {
        clearInterval(pulse)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
