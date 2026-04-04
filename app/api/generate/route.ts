import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { generateTrip, validateTripRequest, deduplicatePlaces } from '@/lib/claude'
import { clampLateTimes } from '@/lib/edit-trip'
import { saveTrip, getTrip } from '@/lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '@/lib/url-helpers'
import { generateAndUploadOgImage } from '@/lib/og'
import { fetchHeroImage } from '@/lib/unsplash'
import { validateRestaurants, geocodeAllPlaces } from '@/lib/google-places'
import { optimizeRoutes } from '@/lib/route-optimizer'
import { authOptions } from '@/lib/auth'
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
  const validation = validateTripRequest(prompt)
  if (!validation.valid) {
    return Response.json({ error: validation.message }, { status: 400 })
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
        // Get userId if logged in (optional — anonymous trips work fine)
        const session = await getServerSession(authOptions).catch(() => null)
        const userId = (session?.user as any)?.id as string | undefined

        const t0 = Date.now()
        const generation = await generateTrip(prompt, (event) => {
          if (event.type === 'day') {
            send({ type: 'progress', dayNumber: event.dayNumber, totalDays: event.totalDays })
          }
        })
        console.log(`[Pipeline] generateTrip: ${Date.now() - t0}ms`)

        // Clamp late times (>9:30 PM) and fix night markets before 5 PM
        clampLateTimes(generation)

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
          ...(userId && { userId }),
          days: previewDays,
        }

        // Save preview and tell client to navigate immediately
        await saveTrip(tripId, previewTrip)
        send({ type: 'preview', tripId })

        // Validate restaurants against Google Places API
        send({ type: 'validating' })
        const t1 = Date.now()
        const validated = deduplicatePlaces(await validateRestaurants(generation))
        console.log(`[Pipeline] validateRestaurants + dedup: ${Date.now() - t1}ms`)

        // Geocode all places and optimize routes per day
        send({ type: 'optimizing' })
        const t2 = Date.now()
        const geocoded = await geocodeAllPlaces(validated)
        console.log(`[Pipeline] geocodeAllPlaces: ${Date.now() - t2}ms`)
        const t3 = Date.now()
        const optimized = optimizeRoutes(validated, geocoded)
        console.log(`[Pipeline] optimizeRoutes: ${Date.now() - t3}ms`)

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
          ...(userId && { userId }),
          days,
        }

        send({ type: 'saving' })

        // Save trip immediately so user can view it fast
        const t4 = Date.now()
        await saveTrip(tripId, trip)
        console.log(`[Pipeline] saveTrip (final): ${Date.now() - t4}ms`)
        console.log(`[Pipeline] TOTAL (after generateTrip): ${Date.now() - t0}ms`)
        revalidatePath(`/trip/${tripId}`)
        send({ type: 'done', tripId })

        // Generate hero + OG images in background, then MERGE onto current Redis state
        // (must re-read from Redis to avoid overwriting edits the user made while images were loading)
        Promise.all([
          fetchHeroImage(optimized.destination),
          generateAndUploadOgImage(trip),
        ]).then(async ([heroResult, ogImageUrl]) => {
          if (!heroResult && !ogImageUrl) return

          // Re-read current trip from Redis (may have been edited by user)
          const currentTrip = await getTrip(tripId)
          if (!currentTrip) return

          let updated = false
          if (heroResult) {
            currentTrip.heroImageUrl = heroResult.imageUrl
            currentTrip.heroImageCredit = heroResult.credit
            updated = true
          }
          if (ogImageUrl) {
            currentTrip.ogImageUrl = ogImageUrl
            updated = true
          }
          if (updated) {
            await saveTrip(tripId, currentTrip)
            revalidatePath(`/trip/${tripId}`)
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
