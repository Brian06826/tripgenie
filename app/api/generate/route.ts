import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { generateTrip, validateTripRequest, deduplicatePlaces, backfillSpareDays } from '@/lib/claude'
import { clampLateTimes, sortPlacesByTime } from '@/lib/edit-trip'
import { saveTrip, getTrip, addTripToUserIndex } from '@/lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '@/lib/url-helpers'
import { generateAndUploadOgImage } from '@/lib/og'
import { fetchHeroImage } from '@/lib/unsplash'
import { validateRestaurants, geocodeAllPlaces } from '@/lib/google-places'
import { optimizeRoutes } from '@/lib/route-optimizer'
import { authOptions } from '@/lib/auth'
import { isRateLimited, rateLimitResponse } from '@/lib/rate-limit'
import { getOrCreateUID, resolveUID, checkUsage, recordUsage } from '@/lib/usage'
import type { Trip } from '@/lib/types'

export const maxDuration = 300

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (await isRateLimited(`gen:${ip}`, 15, 3600)) {
    return rateLimitResponse()
  }

  let body: { prompt?: string; language?: string; native?: boolean }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  const language = body.language as 'en' | 'zh-TW' | 'zh-CN' | undefined
  const native = body.native === true
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

  // Usage check — free tier or Trip Pass
  const cookieUID = await getOrCreateUID()
  const session0 = await getServerSession(authOptions).catch(() => null)
  const uid = resolveUID((session0?.user as any)?.id, cookieUID)
  const limit = native ? 7 : 4
  const usage = await checkUsage(uid, native)
  if (!usage.allowed) {
    return Response.json(
      { error: 'usage_limit', used: limit, limit, native },
      { status: 403 }
    )
  }

  // Generate tripId upfront so the client can track this job even if SSE disconnects
  const tripId = nanoid(8)

  const encoder = new TextEncoder()
  // Track whether client is still connected
  let clientConnected = true

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        if (!clientConnected) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Client disconnected — continue server-side processing
          clientConnected = false
        }
      }

      // Send tripId immediately so client can recover if app is backgrounded
      send({ type: 'tripId', tripId })
      send({ type: 'heartbeat' })
      const pulse = setInterval(() => send({ type: 'heartbeat' }), 5000)

      try {
        // Get userId if logged in (optional — anonymous trips work fine)
        const session = await getServerSession(authOptions).catch(() => null)
        const userId = (session?.user as any)?.id as string | undefined

        const t0 = Date.now()
        const generation = await generateTrip(prompt, language, (event) => {
          if (event.type === 'day') {
            send({ type: 'progress', dayNumber: event.dayNumber, totalDays: event.totalDays })
          }
        })
        console.log(`[Pipeline] generateTrip: ${Date.now() - t0}ms`)

        // Clamp late times (>9:30 PM) and fix night markets before 5 PM, then sort chronologically
        clampLateTimes(generation)
        sortPlacesByTime(generation)

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

        // Save preview so client can navigate (or poll and find it)
        await saveTrip(tripId, previewTrip)
        if (userId) await addTripToUserIndex(userId, tripId)
        send({ type: 'preview', tripId })

        // Validate restaurants against Google Places API
        send({ type: 'validating' })
        const t1 = Date.now()
        let validated = deduplicatePlaces(await validateRestaurants(generation))
        console.log(`[Pipeline] validateRestaurants + dedup: ${Date.now() - t1}ms`)

        // Backfill any days that ended up with too few places after validation + dedup
        const t1b = Date.now()
        validated = await backfillSpareDays(validated)
        clampLateTimes(validated)
        sortPlacesByTime(validated)
        console.log(`[Pipeline] backfillSpareDays: ${Date.now() - t1b}ms`)

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

        // Record usage AFTER successful generation (failures don't count)
        await recordUsage(uid)

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
        try { controller.close() } catch {}
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
