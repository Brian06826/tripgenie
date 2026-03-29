import { getTrip, saveTrip } from '@/lib/storage'
import { validateRestaurants, geocodeAllPlaces } from '@/lib/google-places'
import { optimizeRoutes } from '@/lib/route-optimizer'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '@/lib/url-helpers'
import type { Trip } from '@/lib/types'

export const maxDuration = 60

export async function POST(request: Request) {
  let body: { tripId?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const tripId = body.tripId?.trim()
  if (!tripId) {
    return Response.json({ error: 'tripId is required' }, { status: 400 })
  }

  const trip = await getTrip(tripId)
  if (!trip) {
    return Response.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Skip if already validated
  if (trip.validated) {
    return Response.json({ trip })
  }

  try {
    // Build a TripGeneration-shaped object from the stored trip for validation
    const generation = {
      title: trip.title,
      destination: trip.destination,
      language: trip.language,
      days: trip.days.map(day => ({
        dayNumber: day.dayNumber,
        title: day.title,
        places: day.places.map(place => ({
          name: place.name,
          nameLocal: place.nameLocal,
          type: place.type,
          description: place.description,
          arrivalTime: place.arrivalTime,
          duration: place.duration,
          googleRating: place.googleRating,
          googleReviewCount: place.googleReviewCount,
          yelpRating: place.yelpRating,
          yelpReviewCount: place.yelpReviewCount,
          address: place.address,
          parking: place.parking,
          tips: place.tips,
          priceRange: place.priceRange,
          backupOptions: place.backupOptions?.map(b => ({
            name: b.name,
            nameLocal: b.nameLocal,
            description: b.description,
            googleRating: b.googleRating,
            yelpRating: b.yelpRating,
            address: b.address,
          })),
        })),
      })),
    }

    // Validate restaurants
    const validated = await validateRestaurants(generation)

    // Geocode + optimize routes
    const geocoded = await geocodeAllPlaces(validated)
    const optimized = optimizeRoutes(validated, geocoded)

    // Rebuild full trip with URLs
    const updatedDays = optimized.days.map(day => ({
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

    const updatedTrip: Trip = {
      ...trip,
      days: updatedDays as Trip['days'],
      validated: true,
    }

    await saveTrip(tripId, updatedTrip)

    return Response.json({ trip: updatedTrip })
  } catch (err) {
    console.error('Validation error:', err)
    return Response.json({ error: 'Validation failed' }, { status: 500 })
  }
}
