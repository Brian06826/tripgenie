import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { generateTrip } from '@/lib/claude'
import { saveTrip } from '@/lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl, buildYelpBizUrl } from '@/lib/url-helpers'
import { generateAndUploadOgImage } from '@/lib/og'
import { fetchHeroImage } from '@/lib/unsplash'
import type { Trip } from '@/lib/types'

export const maxDuration = 60

export async function POST(request: Request) {
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

  try {
    const generation = await generateTrip(prompt)

    const tripId = nanoid(8)

    // Add server-side URLs to each place
    const days = generation.days.map(day => ({
      ...day,
      places: day.places.map(place => ({
        ...place,
        googleMapsUrl: buildGoogleMapsUrl(place.name, generation.destination),
        googleReviewsUrl: buildGoogleReviewsUrl(place.name, generation.destination),
        yelpUrl: buildYelpUrl(place.name, generation.destination),
        yelpBizUrl: buildYelpBizUrl(place.name, generation.destination) ?? undefined,
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

    // Fetch hero + OG image in parallel (non-blocking failures)
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

    return NextResponse.json({ tripId, success: true })
  } catch (err) {
    console.error('Generation error:', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
