import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { saveTrip, getTrip } from '@/lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '@/lib/url-helpers'
import { isRateLimited, rateLimitResponse } from '@/lib/rate-limit'
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

/** Calculate hotel check-in time: 30 min after the last activity ends */
function calculateCheckinTime(places: Place[]): string {
  if (places.length === 0) return '9:00 PM'

  const last = places[places.length - 1]
  if (!last.arrivalTime) return '9:00 PM'

  // Parse arrival time like "7:00 PM", "9:30 PM"
  const match = last.arrivalTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return '9:00 PM'

  let hours = parseInt(match[1], 10)
  const mins = parseInt(match[2], 10)
  const period = match[3].toUpperCase()

  // Convert to 24h
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  // Estimate end time: parse duration like "1-2 hours", "45 min", "Check-in"
  let addMinutes = 60 // default 1 hour
  if (last.duration) {
    const hourMatch = last.duration.match(/(\d+)(?:\s*-\s*\d+)?\s*hour/i)
    const minMatch = last.duration.match(/(\d+)\s*min/i)
    if (hourMatch) addMinutes = parseInt(hourMatch[1], 10) * 60
    else if (minMatch) addMinutes = parseInt(minMatch[1], 10)
  }

  // Add duration + 30 min travel to hotel
  const totalMins = hours * 60 + mins + addMinutes + 30
  let checkinHours = Math.floor(totalMins / 60) % 24
  const checkinMins = totalMins % 60

  // Cap at 11:30 PM
  if (checkinHours >= 23 && checkinMins > 30) {
    return '11:30 PM'
  }
  if (checkinHours >= 24) {
    return '11:30 PM'
  }

  // Convert back to 12h format
  const p = checkinHours >= 12 ? 'PM' : 'AM'
  const h = checkinHours > 12 ? checkinHours - 12 : checkinHours === 0 ? 12 : checkinHours
  return `${h}:${checkinMins.toString().padStart(2, '0')} ${p}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tripId, hotelName, dayNumber, language, bookingUrl } = body

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (await isRateLimited(`addhotel:${ip}`, 10, 3600)) {
      return rateLimitResponse(language)
    }

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
    // Use request language, fall back to trip's language
    const lang = language || trip.language || 'en'
    const isChinese = lang === 'zh-TW' || lang === 'zh-HK' || lang === 'zh-CN'
    const city = trip.destination
    const dayPlaces = trip.days[dayIndex].places

    // Calculate check-in time based on last activity
    const checkinTime = calculateCheckinTime(dayPlaces)

    // Geocode the hotel to get real coordinates and address (NOT rating — unreliable for manual input)
    const geo = await geocodeHotel(name, city)

    // Ensure bookingUrl has protocol prefix
    let cleanBookingUrl: string | undefined
    if (bookingUrl && typeof bookingUrl === 'string' && bookingUrl.trim()) {
      let url = bookingUrl.trim()
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url
      cleanBookingUrl = url
    }

    // Use "hotel" keyword in search URLs for better results
    const searchName = `${name} hotel`

    const hotelPlace: Place = {
      name,
      type: 'hotel',
      description: isChinese ? '回酒店休息' : 'Return to hotel',
      arrivalTime: checkinTime,
      duration: isChinese ? '入住' : 'Check-in',
      googleMapsUrl: buildGoogleMapsUrl(searchName, city),
      googleReviewsUrl: buildGoogleReviewsUrl(searchName, city),
      yelpUrl: buildYelpUrl(name, city),
      ...(geo?.lat != null && { lat: geo.lat }),
      ...(geo?.lng != null && { lng: geo.lng }),
      ...(geo?.address && { address: geo.address }),
      // Do NOT include googleRating — manual hotel adds have no verified rating
      ...(cleanBookingUrl && { bookingUrl: cleanBookingUrl }),
    }

    // ALWAYS append hotel as the LAST item of the day
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
