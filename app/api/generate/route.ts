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

export async function POST(request: Request) {
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

        // Validate restaurants against Google Places API
        send({ type: 'validating' })
        const validated = await validateRestaurants(generation)

        // Geocode all places and optimize routes per day
        send({ type: 'optimizing' })
        const geocoded = await geocodeAllPlaces(validated)
        const optimized = optimizeRoutes(validated, geocoded)

        const tripId = nanoid(8)

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

        const [heroResult, ogImageUrl] = await Promise.all([
          fetchHeroImage(optimized.destination),
          generateAndUploadOgImage(trip),
        ])
        if (heroResult) {
          trip.heroImageUrl = heroResult.imageUrl
          trip.heroImageCredit = heroResult.credit
        }
        if (ogImageUrl) trip.ogImageUrl = ogImageUrl

        await saveTrip(tripId, trip)

        send({ type: 'done', tripId })
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
