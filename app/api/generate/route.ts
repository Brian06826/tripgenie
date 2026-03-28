import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { generateTrip } from '@/lib/claude'
import { saveTrip } from '@/lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '@/lib/url-helpers'
import { generateAndUploadOgImage } from '@/lib/og'
import { fetchHeroImage } from '@/lib/unsplash'
import type { Trip } from '@/lib/types'

export const maxDuration = 60

export async function POST(request: Request) {
  // Validate request before starting the stream
  let body: { prompt?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }
  if (prompt.length > 500) {
    return NextResponse.json({ error: 'prompt too long (max 500 chars)' }, { status: 400 })
  }

  // Stream the generation so Vercel sees data before the 60s timeout
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send IMMEDIATELY — Vercel's 60s timeout is first-byte only.
      // This heartbeat resets the clock before we even call Claude.
      send({ type: 'heartbeat' })

      // Also pulse every 5 seconds so long retries/saves don't stall.
      const pulse = setInterval(() => { try { send({ type: 'heartbeat' }) } catch {} }, 5000)

      try {
        const generation = await generateTrip(prompt)

        const tripId = nanoid(8)

        const days = generation.days.map(day => ({
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

        const trip: Trip = {
          ...generation,
          id: tripId,
          createdAt: new Date().toISOString(),
          days,
        }

        // Hero + OG images — signal client we're in the save phase
        send({ type: 'saving' })

        const [heroResult, ogImageUrl] = await Promise.all([
          fetchHeroImage(generation.destination),
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
