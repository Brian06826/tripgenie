import { NextResponse } from 'next/server'
import { editPlace } from '@/lib/edit'
import { isRateLimited, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { instruction, currentPlace, destination, language } = body

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (await isRateLimited(`editplace:${ip}`, 20, 3600)) {
      return rateLimitResponse(language)
    }

    if (!instruction || !currentPlace || !destination) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await editPlace(instruction, currentPlace, destination, language ?? 'en')

    if (result.removed) {
      return NextResponse.json({ removed: true })
    }

    if (!result.place) {
      return NextResponse.json({ error: 'No replacement generated' }, { status: 500 })
    }

    // Build URLs for the replacement place
    const place = result.place
    const encodedName = encodeURIComponent(place.name)
    const encodedDest = encodeURIComponent(destination)

    return NextResponse.json({
      removed: false,
      place: {
        ...place,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodedName}+${encodedDest}`,
        googleReviewsUrl: `https://www.google.com/search?q=${encodedName}+${encodedDest}+reviews`,
        yelpUrl: `https://www.yelp.com/search?find_desc=${encodedName}&find_loc=${encodedDest}`,
      },
    })
  } catch (err) {
    console.error('[edit-place] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to edit place' },
      { status: 500 },
    )
  }
}
