import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { editTrip, clampLateTimes } from '@/lib/edit-trip'
import { saveTrip, getTrip } from '@/lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '@/lib/url-helpers'
import { geocodeAllPlaces } from '@/lib/google-places'
import { optimizeRoutes } from '@/lib/route-optimizer'
import type { Trip, TripGeneration } from '@/lib/types'

export const maxDuration = 300

// Rate limiter: 10 edits per tripId per hour
const editRateMap = new Map<string, number[]>()
const EDIT_LIMIT = 10
const EDIT_WINDOW_MS = 3_600_000

function isEditRateLimited(tripId: string): boolean {
  const now = Date.now()
  const timestamps = editRateMap.get(tripId) ?? []
  const recent = timestamps.filter(t => now - t < EDIT_WINDOW_MS)
  if (recent.length >= EDIT_LIMIT) return true
  recent.push(now)
  editRateMap.set(tripId, recent)
  // Prevent memory leak
  if (editRateMap.size > 500) {
    for (const [key, ts] of editRateMap) {
      if (ts.every(t => now - t > EDIT_WINDOW_MS)) editRateMap.delete(key)
    }
  }
  return false
}

/** Strip a stored Trip down to the generation schema Claude expects (no URLs, coords, travel info). */
function stripToGeneration(trip: Trip): TripGeneration {
  return {
    title: trip.title,
    destination: trip.destination,
    language: trip.language,
    days: trip.days.map(day => ({
      dayNumber: day.dayNumber,
      title: day.title,
      places: day.places.map(place => {
        const base: Record<string, unknown> = {
          name: place.name,
          type: place.type,
          description: place.description,
        }
        if (place.nameLocal) base.nameLocal = place.nameLocal
        if (place.arrivalTime) base.arrivalTime = place.arrivalTime
        if (place.duration) base.duration = place.duration
        if (place.googleRating) base.googleRating = place.googleRating
        if (place.googleReviewCount) base.googleReviewCount = place.googleReviewCount
        if (place.yelpRating) base.yelpRating = place.yelpRating
        if (place.yelpReviewCount) base.yelpReviewCount = place.yelpReviewCount
        if (place.tips) base.tips = place.tips
        if (place.priceRange) base.priceRange = place.priceRange
        if (place.backupOptions?.length) {
          base.backupOptions = place.backupOptions.map(b => {
            const bo: Record<string, unknown> = { name: b.name, description: b.description }
            if (b.nameLocal) bo.nameLocal = b.nameLocal
            if (b.googleRating) bo.googleRating = b.googleRating
            return bo
          })
        }
        return base
      }),
    })),
  } as TripGeneration
}


export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tripId, instruction, tripData } = body

    if (!tripId || typeof tripId !== 'string') {
      return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })
    }

    // ── Undo mode: save provided trip data back to storage ──
    if (tripData) {
      await saveTrip(tripId, tripData as Trip)
      revalidatePath(`/trip/${tripId}`)
      return NextResponse.json({ success: true, trip: tripData })
    }

    // ── Edit mode ──
    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
      return NextResponse.json({ error: 'Missing instruction' }, { status: 400 })
    }

    if (isEditRateLimited(tripId)) {
      return NextResponse.json(
        { error: 'Too many edits. Please wait before making more changes.' },
        { status: 429 },
      )
    }

    // 1. Fetch current trip
    const currentTrip = await getTrip(tripId)
    if (!currentTrip) {
      return NextResponse.json({ error: 'Trip not found or expired' }, { status: 404 })
    }

    const generationData = stripToGeneration(currentTrip)
    const language = body.language ?? currentTrip.language ?? 'en'

    // 2. Call Claude to edit
    const edited = await editTrip(generationData, instruction.trim(), language)

    // 3. Build set of places that already have coords (skip re-geocoding)
    const existingCoords = new Map<string, { lat: number; lng: number }>()
    for (const day of currentTrip.days) {
      for (const place of day.places) {
        if (place.lat != null && place.lng != null) {
          existingCoords.set(place.name.toLowerCase(), { lat: place.lat, lng: place.lng })
        }
      }
    }

    // Only geocode places that are new or changed (no existing coords)
    const needsGeocode: typeof edited = {
      ...edited,
      days: edited.days.map(day => ({
        ...day,
        places: day.places.filter(p => !existingCoords.has(p.name.toLowerCase())),
      })),
    }

    const freshGeocoded = await geocodeAllPlaces(needsGeocode)

    // Merge fresh geocodes with existing coords into a unified list
    const allGeocoded = [...freshGeocoded]
    for (let di = 0; di < edited.days.length; di++) {
      for (let pi = 0; pi < edited.days[di].places.length; pi++) {
        const place = edited.days[di].places[pi]
        const existing = existingCoords.get(place.name.toLowerCase())
        if (existing && !freshGeocoded.some(g => g.dayIndex === di && g.placeIndex === pi)) {
          allGeocoded.push({ dayIndex: di, placeIndex: pi, ...existing })
        }
      }
    }

    const optimized = optimizeRoutes(edited, allGeocoded)

    // Build coord lookup from all geocoded results (fresh + existing)
    const coordMap = new Map<string, { lat: number; lng: number }>()
    for (const g of allGeocoded) {
      const place = optimized.days[g.dayIndex]?.places[g.placeIndex]
      if (place) coordMap.set(`${g.dayIndex}:${place.name}`, { lat: g.lat, lng: g.lng })
    }

    // 5. Build final Trip with URLs and coords
    const days = optimized.days.map((day, di) => ({
      ...day,
      places: day.places.map((place, pi) => {
        const coord = coordMap.get(`${di}:${place.name}`)
        return {
          ...place,
          googleMapsUrl: buildGoogleMapsUrl(place.name, optimized.destination),
          googleReviewsUrl: buildGoogleReviewsUrl(place.name, optimized.destination),
          yelpUrl: buildYelpUrl(place.name, optimized.destination),
          lat: coord?.lat,
          lng: coord?.lng,
          backupOptions: place.backupOptions?.map(b => ({
            ...b,
            googleMapsUrl: buildGoogleMapsUrl(b.name, optimized.destination),
            yelpUrl: buildYelpUrl(b.name, optimized.destination),
          })),
        }
      }),
    }))

    const updatedTrip: Trip = {
      ...optimized,
      id: tripId,
      createdAt: currentTrip.createdAt,
      validated: currentTrip.validated,
      heroImageUrl: currentTrip.heroImageUrl,
      heroImageCredit: currentTrip.heroImageCredit,
      ogImageUrl: currentTrip.ogImageUrl,
      days,
    }

    // 6. Clamp late times as a safety net, then save
    clampLateTimes(updatedTrip)
    await saveTrip(tripId, updatedTrip)
    revalidatePath(`/trip/${tripId}`)

    return NextResponse.json({ success: true, trip: updatedTrip })
  } catch (err) {
    console.error('[edit-trip] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to edit trip' },
      { status: 500 },
    )
  }
}
