import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { saveTrip, getTrip } from '@/lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '@/lib/url-helpers'
import type { Place } from '@/lib/types'

export const maxDuration = 30

const PLACES_API = 'https://maps.googleapis.com/maps/api/place'

/** Geocode a single hotel name to get lat/lng + formatted address */
async function geocodeHotel(
  hotelName: string,
  city: string,
): Promise<{ lat: number; lng: number; address?: string; rating?: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  try {
    const params = new URLSearchParams({
      input: `${hotelName} hotel ${city}`,
      inputtype: 'textquery',
      fields: 'geometry,formatted_address,rating',
      key: apiKey,
    })

    const res = await fetch(`${PLACES_API}/findplacefromtext/json?${params}`)
    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== 'OK' || !data.candidates?.length) return null

    const place = data.candidates[0]
    return {
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,
      address: place.formatted_address,
      rating: place.rating,
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tripId, hotelName, dayNumber, language } = body

    if (!tripId || typeof tripId !== 'string') {
      return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })
    }
    if (!hotelName || typeof hotelName !== 'string' || !hotelName.trim()) {
      return NextResponse.json({ error: 'Missing hotelName' }, { status: 400 })
    }
    if (!dayNumber || typeof dayNumber !== 'number') {
      return NextResponse.json({ error: 'Missing dayNumber' }, { status: 400 })
    }

    const trip = await getTrip(tripId)
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found or expired' }, { status: 404 })
    }

    const dayIndex = trip.days.findIndex(d => d.dayNumber === dayNumber)
    if (dayIndex === -1) {
      return NextResponse.json({ error: 'Day not found' }, { status: 400 })
    }

    const name = hotelName.trim()
    const isChinese = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'
    const city = trip.destination

    // Geocode the hotel to get real coordinates, address, and rating
    const geo = await geocodeHotel(name, city)

    const hotelPlace: Place = {
      name,
      type: 'hotel',
      description: isChinese ? '酒店入住' : 'Hotel Check-in',
      arrivalTime: '3:00 PM',
      duration: isChinese ? '入住' : 'Check-in',
      googleMapsUrl: buildGoogleMapsUrl(name, city),
      googleReviewsUrl: buildGoogleReviewsUrl(name, city),
      yelpUrl: buildYelpUrl(name, city),
      ...(geo?.lat != null && { lat: geo.lat }),
      ...(geo?.lng != null && { lng: geo.lng }),
      ...(geo?.address && { address: geo.address }),
      ...(geo?.rating && { googleRating: geo.rating }),
    }

    // Append hotel as last place of the target day
    const updatedDays = trip.days.map((day, i) => {
      if (i !== dayIndex) return day
      return { ...day, places: [...day.places, hotelPlace] }
    })

    const updatedTrip = { ...trip, days: updatedDays }
    await saveTrip(tripId, updatedTrip)
    revalidatePath(`/trip/${tripId}`)

    return NextResponse.json({ success: true, trip: updatedTrip })
  } catch (err) {
    console.error('[add-hotel] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add hotel' },
      { status: 500 },
    )
  }
}
