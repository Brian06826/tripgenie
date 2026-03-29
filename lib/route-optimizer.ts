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
  // Average speeds: driving ~30 km/h city, transit ~20 km/h (with waits)
  const speedKmh = mode.mode === 'transit' ? 20 : 30
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

  // Build a lookup: `${dayIndex}-${placeIndex}` → coords
  const coordMap = new Map<string, { lat: number; lng: number }>()
  for (const g of geocoded) {
    coordMap.set(`${g.dayIndex}-${g.placeIndex}`, { lat: g.lat, lng: g.lng })
  }

  const out: OptimizedTrip = JSON.parse(JSON.stringify(generation))

  for (let di = 0; di < out.days.length; di++) {
    const day = out.days[di]
    const places = day.places

    // Build coords array for this day
    const withCoords: PlaceWithCoords[] = []
    for (let pi = 0; pi < places.length; pi++) {
      const coords = coordMap.get(`${di}-${pi}`)
      if (coords) {
        withCoords.push({ originalIndex: pi, lat: coords.lat, lng: coords.lng })
      }
    }

    // Only reorder if we have coords for most places (>= 60%)
    if (withCoords.length >= Math.ceil(places.length * 0.6)) {
      const newOrder = nearestNeighborOrder(withCoords)

      // Add places without coords at their original positions
      const hasCoords = new Set(withCoords.map(w => w.originalIndex))
      const noCoords = places
        .map((_, i) => i)
        .filter(i => !hasCoords.has(i))

      // Merge: insert no-coord places at roughly their original relative position
      const reordered = [...newOrder]
      for (const idx of noCoords) {
        // Insert at the position closest to their original index ratio
        const ratio = idx / places.length
        const insertAt = Math.round(ratio * reordered.length)
        reordered.splice(insertAt, 0, idx)
      }

      // Reorder the places array
      const originalPlaces = [...places]
      for (let i = 0; i < reordered.length; i++) {
        day.places[i] = originalPlaces[reordered[i]]
      }
    }

    // Attach lat/lng and compute travel times between consecutive stops
    for (let pi = 0; pi < day.places.length; pi++) {
      const coords = coordMap.get(`${di}-${pi}`) ??
        // After reorder, we need to find coords by matching the original index
        (() => {
          // The place at position pi now might have been at a different original position
          // We stored coords by original index, so scan geocoded for matching name
          for (const g of geocoded) {
            if (g.dayIndex === di) {
              const origPlace = generation.days[di].places[g.placeIndex]
              if (origPlace && origPlace.name === day.places[pi].name) {
                return { lat: g.lat, lng: g.lng }
              }
            }
          }
          return null
        })()

      if (coords) {
        day.places[pi].lat = coords.lat
        day.places[pi].lng = coords.lng
      }

      if (pi > 0) {
        const prev = day.places[pi - 1]
        const curr = day.places[pi]
        if (prev.lat && prev.lng && curr.lat && curr.lng) {
          const dist = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng)
          const minutes = estimateTravelMinutes(dist, transport)
          day.places[pi].travelFromPrevious = {
            duration: formatMinutes(minutes),
            mode: transport.mode,
            emoji: transport.emoji,
          }
        }
      }
    }

    // Recalculate arrival times based on travel + duration
    const firstPlace = day.places[0]
    const firstTime = firstPlace?.arrivalTime ? parseTime(firstPlace.arrivalTime) : null

    if (firstTime) {
      let currentTime = firstTime
      for (let pi = 0; pi < day.places.length; pi++) {
        const place = day.places[pi]

        if (pi === 0) {
          // Keep the first arrival time as-is
        } else {
          // Previous place duration + travel time
          const prevPlace = day.places[pi - 1]
          const stayMin = prevPlace.duration ? parseDurationMinutes(prevPlace.duration) : 60
          const travelMin = place.travelFromPrevious
            ? parseDurationMinutes(place.travelFromPrevious.duration)
            : 15

          currentTime = addMinutes(currentTime.hours, currentTime.minutes, stayMin + travelMin)
          place.arrivalTime = formatTime(currentTime.hours, currentTime.minutes)
        }
      }
    }
  }

  return out
}
