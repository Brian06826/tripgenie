import type { TripGeneration } from './types'
import type { GeocodedPlace } from './google-places'

// ---------------------------------------------------------------------------
// Transportation mode detection
// ---------------------------------------------------------------------------

const TRANSIT_CITIES = new Set([
  'tokyo', 'osaka', 'kyoto', 'seoul', 'busan',
  'hong kong', 'taipei', 'singapore',
  'london', 'paris', 'berlin', 'amsterdam', 'barcelona', 'madrid', 'rome', 'milan',
  'new york', 'manhattan', 'brooklyn', 'chicago', 'san francisco', 'boston', 'washington dc',
  'shanghai', 'beijing', 'guangzhou', 'shenzhen',
  'bangkok', 'kuala lumpur',
  'sydney', 'melbourne',
  'toronto', 'montreal', 'vancouver',
])

type TransportMode = { mode: string; emoji: string }

function getTransportMode(destination: string): TransportMode {
  const dest = destination.toLowerCase()
  for (const city of TRANSIT_CITIES) {
    if (dest.includes(city)) return { mode: 'transit', emoji: '🚇' }
  }
  return { mode: 'driving', emoji: '🚗' }
}

// ---------------------------------------------------------------------------
// Haversine distance (km)
// ---------------------------------------------------------------------------

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ---------------------------------------------------------------------------
// Estimate travel time from distance
// ---------------------------------------------------------------------------

function estimateTravelMinutes(distKm: number, mode: TransportMode): number {
  // Scale speed by distance: short trips are city driving, long trips hit highways
  let speedKmh: number
  if (mode.mode === 'transit') {
    speedKmh = distKm > 30 ? 40 : 20 // express train vs local transit
  } else {
    speedKmh = distKm > 50 ? 80 : distKm > 15 ? 45 : 30 // highway vs suburb vs city
  }
  const minutes = (distKm / speedKmh) * 60
  // Minimum 5 min, round to nearest 5
  return Math.max(5, Math.round(minutes / 5) * 5)
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

// ---------------------------------------------------------------------------
// Nearest-neighbor route sorting
// ---------------------------------------------------------------------------

interface PlaceWithCoords {
  originalIndex: number
  lat: number
  lng: number
}

function nearestNeighborOrder(places: PlaceWithCoords[]): number[] {
  if (places.length <= 2) return places.map(p => p.originalIndex)

  const visited = new Set<number>()
  const order: number[] = []

  // Start with the first place (keep it anchored as the starting point)
  let current = places[0]
  visited.add(0)
  order.push(current.originalIndex)

  while (visited.size < places.length) {
    let nearest = -1
    let nearestDist = Infinity

    for (let i = 0; i < places.length; i++) {
      if (visited.has(i)) continue
      const dist = haversineKm(current.lat, current.lng, places[i].lat, places[i].lng)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = i
      }
    }

    if (nearest === -1) break
    visited.add(nearest)
    current = places[nearest]
    order.push(current.originalIndex)
  }

  return order
}

// ---------------------------------------------------------------------------
// Parse / recompute arrival times
// ---------------------------------------------------------------------------

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  // "9:00 AM", "2:30 PM", "10:00 AM"
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return { hours, minutes }
}

function formatTime(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM'
  const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${h}:${minutes.toString().padStart(2, '0')} ${period}`
}

function parseDurationMinutes(duration: string): number {
  // "1-2 hours" → 90, "2 hours" → 120, "30 min" → 30, "1.5 hours" → 90
  const hourMatch = duration.match(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*hours?/i)
  if (hourMatch) {
    const low = parseFloat(hourMatch[1])
    const high = hourMatch[2] ? parseFloat(hourMatch[2]) : low
    return Math.round(((low + high) / 2) * 60)
  }
  const minMatch = duration.match(/(\d+)\s*min/i)
  if (minMatch) return parseInt(minMatch[1], 10)
  return 60 // default 1 hour
}

function addMinutes(hours: number, minutes: number, addMin: number): { hours: number; minutes: number } {
  const total = hours * 60 + minutes + addMin
  return { hours: Math.floor(total / 60) % 24, minutes: total % 60 }
}

// ---------------------------------------------------------------------------
// Public: optimize routes for a trip
// ---------------------------------------------------------------------------

export interface TravelInfo {
  duration: string
  mode: string
  emoji: string
}

export interface OptimizedTrip extends TripGeneration {
  days: Array<TripGeneration['days'][number] & {
    places: Array<TripGeneration['days'][number]['places'][number] & {
      lat?: number
      lng?: number
      travelFromPrevious?: TravelInfo
    }>
  }>
}

export function optimizeRoutes(
  generation: TripGeneration,
  geocoded: GeocodedPlace[],
): OptimizedTrip {
  const transport = getTransportMode(generation.destination)

  // Build a name-based lookup so coords survive reordering
  // Key: `${dayIndex}:${placeName}` → coords
  const nameCoordMap = new Map<string, { lat: number; lng: number }>()
  for (const g of geocoded) {
    const place = generation.days[g.dayIndex]?.places[g.placeIndex]
    if (place) {
      nameCoordMap.set(`${g.dayIndex}:${place.name}`, { lat: g.lat, lng: g.lng })
    }
  }

  const out: OptimizedTrip = JSON.parse(JSON.stringify(generation))

  for (let di = 0; di < out.days.length; di++) {
    const day = out.days[di]
    const places = day.places

    // Attach coords to places BEFORE reordering
    for (let pi = 0; pi < places.length; pi++) {
      const coords = nameCoordMap.get(`${di}:${places[pi].name}`)
      if (coords) {
        places[pi].lat = coords.lat
        places[pi].lng = coords.lng
      }
    }

    // Identify pinned positions: transport stops at start/end stay put
    const pinnedFirst = places[0]?.type === 'transport' ? 0 : -1
    const pinnedLast = places.length > 1 && places[places.length - 1]?.type === 'transport'
      ? places.length - 1 : -1

    // Build coords array for nearest-neighbor sorting (exclude pinned transport stops)
    const withCoords: PlaceWithCoords[] = []
    for (let pi = 0; pi < places.length; pi++) {
      if (pi === pinnedFirst || pi === pinnedLast) continue
      if (places[pi].lat != null && places[pi].lng != null) {
        withCoords.push({ originalIndex: pi, lat: places[pi].lat!, lng: places[pi].lng! })
      }
    }

    // Only reorder the non-pinned middle stops if we have coords for most (>= 60%)
    const reorderableCount = places.length - (pinnedFirst >= 0 ? 1 : 0) - (pinnedLast >= 0 ? 1 : 0)
    if (reorderableCount > 0 && withCoords.length >= Math.ceil(reorderableCount * 0.6)) {
      const newOrder = nearestNeighborOrder(withCoords)

      // Add non-pinned places without coords at roughly their original relative position
      const hasCoords = new Set(withCoords.map(w => w.originalIndex))
      const noCoords = places
        .map((_, i) => i)
        .filter(i => i !== pinnedFirst && i !== pinnedLast && !hasCoords.has(i))

      const reordered = [...newOrder]
      for (const idx of noCoords) {
        const ratio = idx / places.length
        const insertAt = Math.round(ratio * reordered.length)
        reordered.splice(insertAt, 0, idx)
      }

      // Reconstruct: pinned first + reordered middle + pinned last
      const originalPlaces = [...places]
      let writeIdx = 0
      if (pinnedFirst >= 0) {
        day.places[writeIdx++] = originalPlaces[pinnedFirst]
      }
      for (const idx of reordered) {
        day.places[writeIdx++] = originalPlaces[idx]
      }
      if (pinnedLast >= 0) {
        day.places[writeIdx++] = originalPlaces[pinnedLast]
      }
    }

    // Compute travel times between consecutive stops (coords already attached)
    for (let pi = 1; pi < day.places.length; pi++) {
      const prev = day.places[pi - 1]
      const curr = day.places[pi]
      if (prev.lat != null && prev.lng != null && curr.lat != null && curr.lng != null) {
        const dist = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng)
        const minutes = estimateTravelMinutes(dist, transport)
        day.places[pi].travelFromPrevious = {
          duration: formatMinutes(minutes),
          mode: transport.mode,
          emoji: transport.emoji,
        }
      }
    }

    // Recalculate arrival times based on travel + duration
    // Use the LARGER of geocoded travel time vs Claude's implied travel in duration
    const firstPlace = day.places[0]
    const firstTime = firstPlace?.arrivalTime ? parseTime(firstPlace.arrivalTime) : null

    if (firstTime) {
      let currentTime = firstTime
      for (let pi = 1; pi < day.places.length; pi++) {
        const place = day.places[pi]
        const prevPlace = day.places[pi - 1]
        const stayMin = prevPlace.duration ? parseDurationMinutes(prevPlace.duration) : 60
        const geocodedTravelMin = place.travelFromPrevious
          ? parseDurationMinutes(place.travelFromPrevious.duration)
          : 15

        // Check if the previous place's duration text contains embedded travel time
        // e.g. "pick up car, 2-hour drive" — the drive IS the travel to next stop
        const durationText = (prevPlace.duration ?? '').toLowerCase()
        const hasEmbeddedTravel = /drive|ride|transfer|commute|travel|ferry/i.test(durationText)

        // If duration embeds travel (e.g. "2-hour drive"), the stay IS the travel.
        // Use the larger of Claude's stated duration vs geocoded distance.
        // Don't double-count by adding both.
        const totalMin = hasEmbeddedTravel
          ? Math.max(stayMin, geocodedTravelMin) // travel is the activity, pick the larger estimate
          : stayMin + geocodedTravelMin // normal: stay + separate travel

        currentTime = addMinutes(currentTime.hours, currentTime.minutes, totalMin)
        place.arrivalTime = formatTime(currentTime.hours, currentTime.minutes)
      }
    }
  }

  return out
}
