import type { TripGeneration } from './types'
import type { GeocodedPlace } from './google-places'

// ---------------------------------------------------------------------------
// Transportation mode detection
// ---------------------------------------------------------------------------

// Compact walkable core + excellent metro — walk short distances, metro for longer
const WALKABLE_TRANSIT_CITIES = new Set([
  // Japan
  'tokyo', 'osaka', 'kyoto', 'kobe', 'yokohama', 'fukuoka', 'nagoya',
  // East Asia
  'taipei', 'kaohsiung', 'hong kong', 'macau', 'singapore', 'seoul',
  // Europe
  'london', 'paris', 'amsterdam', 'barcelona', 'madrid', 'rome', 'florence',
  'venice', 'milan', 'berlin', 'munich', 'vienna', 'prague', 'budapest',
  'copenhagen', 'stockholm', 'lisbon', 'porto', 'brussels', 'dublin',
  'edinburgh', 'zurich',
  // US walkable
  'new york', 'manhattan', 'brooklyn',
])

// Good transit but less walkable (sprawling, hot, or transit-gaps)
const TRANSIT_CITIES = new Set([
  'bangkok', 'kuala lumpur',
  'shanghai', 'beijing', 'guangzhou', 'shenzhen',
  'chicago', 'san francisco', 'boston', 'washington dc',
  'toronto', 'montreal', 'vancouver',
  'sydney', 'melbourne',
  'busan', 'delhi', 'mumbai', 'istanbul',
])

// Taxi/Grab/private car — poor public transit for tourists
const TAXI_CITIES = new Set([
  'bali', 'ubud', 'seminyak', 'kuta', 'canggu',
  'phuket', 'krabi', 'koh samui', 'chiang mai', 'chiang rai',
  'cancun', 'tulum', 'playa del carmen',
  'marrakech', 'cairo', 'luxor',
  'dubai', 'abu dhabi', 'doha',
  'hanoi', 'ho chi minh', 'saigon', 'da nang', 'hoi an', 'nha trang',
  'phnom penh', 'siem reap',
  'colombo', 'galle',
  'cape town', 'zanzibar',
  'athens',
])

// Wide roads, highways — fast driving (mostly US car cities)
const FAST_DRIVING_CITIES = new Set([
  'los angeles', 'la', 'long beach', 'san diego', 'phoenix', 'scottsdale',
  'las vegas', 'houston', 'dallas', 'austin', 'san antonio',
  'denver', 'salt lake city', 'portland', 'seattle',
  'orlando', 'miami', 'tampa', 'jacksonville', 'atlanta',
  'nashville', 'charlotte', 'raleigh', 'minneapolis',
  'honolulu', 'waikiki', 'maui',
  'gold coast', 'brisbane', 'perth', 'adelaide',
])

type TransportMode = {
  mode: string
  emoji: string
  speedProfile: 'walkable-transit' | 'transit' | 'taxi' | 'fast-driving' | 'driving'
}

function getTransportMode(destination: string): TransportMode {
  const dest = destination.toLowerCase()
  for (const city of WALKABLE_TRANSIT_CITIES) {
    if (dest.includes(city)) return { mode: 'transit', emoji: '🚇', speedProfile: 'walkable-transit' }
  }
  for (const city of TRANSIT_CITIES) {
    if (dest.includes(city)) return { mode: 'transit', emoji: '🚇', speedProfile: 'transit' }
  }
  for (const city of TAXI_CITIES) {
    if (dest.includes(city)) return { mode: 'taxi', emoji: '🚕', speedProfile: 'taxi' }
  }
  for (const city of FAST_DRIVING_CITIES) {
    if (dest.includes(city)) return { mode: 'driving', emoji: '🚗', speedProfile: 'fast-driving' }
  }
  return { mode: 'driving', emoji: '🚗', speedProfile: 'driving' }
}

// ---------------------------------------------------------------------------
// Haversine distance (km)
// ---------------------------------------------------------------------------

/**
 * Validate that a coordinate is a real, usable lat/lng value.
 * Catches: null, undefined, NaN, Infinity, (0,0), and out-of-range values.
 */
function isValidCoord(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false // Null Island — almost always a geocoding error
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false
  return true
}

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
  let minutes: number
  switch (mode.speedProfile) {
    case 'walkable-transit':
      // Walk <800m, metro for longer (includes walk to station + wait + walk out)
      if (distKm <= 0.8) {
        minutes = (distKm / 4.5) * 60
      } else {
        const rideSpeed = distKm <= 5 ? 30 : distKm <= 15 ? 35 : 45
        minutes = 8 + (distKm / rideSpeed) * 60 // 8 min platform overhead
      }
      break
    case 'transit':
      // Metro/BTS but less walkable — higher overhead for wayfinding
      if (distKm <= 0.5) {
        minutes = (distKm / 4) * 60
      } else {
        const speed = distKm <= 10 ? 20 : 35
        minutes = 10 + (distKm / speed) * 60
      }
      break
    case 'taxi':
      // Grab/taxi — 5 min pickup overhead + variable traffic
      minutes = 5 + (distKm / (distKm <= 5 ? 15 : distKm <= 15 ? 25 : 40)) * 60
      break
    case 'fast-driving':
      // US highway cities — 5 min to car + drive
      minutes = 5 + (distKm / (distKm <= 5 ? 30 : distKm <= 20 ? 50 : 80)) * 60
      break
    default: // driving
      minutes = 5 + (distKm / (distKm <= 5 ? 25 : distKm <= 20 ? 40 : 70)) * 60
      break
  }
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
  // Also handles "hr" format from formatMinutes(): "2 hr 30 min" → 150
  const hourMatch = duration.match(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(?:hours?|hr)\b/i)
  if (hourMatch) {
    const low = parseFloat(hourMatch[1])
    const high = hourMatch[2] ? parseFloat(hourMatch[2]) : low
    const hourMinutes = Math.round(((low + high) / 2) * 60)
    // Also check for additional minutes: "2 hr 30 min"
    const extraMin = duration.match(/\d+\s*(?:hours?|hr)\s+(\d+)\s*min/i)
    return hourMinutes + (extraMin ? parseInt(extraMin[1], 10) : 0)
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

    // Pin transport at start/end AND all restaurants — only reorder attractions
    // Moving meals around breaks the natural day flow (lunch between morning
    // attractions, dinner drifting to afternoon, etc.)
    const pinned = new Set<number>()
    if (places[0]?.type === 'transport') pinned.add(0)
    if (places.length > 1 && places[places.length - 1]?.type === 'transport') {
      pinned.add(places.length - 1)
    }
    for (let pi = 0; pi < places.length; pi++) {
      if (places[pi].type === 'restaurant') pinned.add(pi)
    }

    // Build coords for nearest-neighbor: only non-pinned places (attractions/other)
    const withCoords: PlaceWithCoords[] = []
    for (let pi = 0; pi < places.length; pi++) {
      if (pinned.has(pi)) continue
      if (isValidCoord(places[pi].lat, places[pi].lng)) {
        withCoords.push({ originalIndex: pi, lat: places[pi].lat!, lng: places[pi].lng! })
      }
    }

    // Only reorder if there are enough non-pinned stops with coords
    const reorderableCount = places.length - pinned.size
    if (reorderableCount > 1 && withCoords.length >= Math.ceil(reorderableCount * 0.6)) {
      const newOrder = nearestNeighborOrder(withCoords)

      const hasCoords = new Set(withCoords.map(w => w.originalIndex))
      const noCoords = places
        .map((_, i) => i)
        .filter(i => !pinned.has(i) && !hasCoords.has(i))

      const reordered = [...newOrder]
      for (const idx of noCoords) {
        const ratio = idx / places.length
        const insertAt = Math.round(ratio * reordered.length)
        reordered.splice(insertAt, 0, idx)
      }

      // Reconstruct: pinned positions stay, non-pinned get reordered
      const originalPlaces = [...places]
      let reorderIdx = 0
      for (let pi = 0; pi < places.length; pi++) {
        if (pinned.has(pi)) {
          day.places[pi] = originalPlaces[pi]
        } else {
          day.places[pi] = originalPlaces[reordered[reorderIdx++]]
        }
      }
    }

    // Compute travel times between consecutive stops (coords already attached)
    // Guards: validate coordinates, reject bad geocoding (>50km within a city), cap at 3 hrs
    for (let pi = 1; pi < day.places.length; pi++) {
      const prev = day.places[pi - 1]
      const curr = day.places[pi]
      if (isValidCoord(prev.lat, prev.lng) && isValidCoord(curr.lat, curr.lng)) {
        const dist = haversineKm(prev.lat!, prev.lng!, curr.lat!, curr.lng!)
        if (!Number.isFinite(dist) || dist > 50) continue // bad geocoding — skip
        let minutes = estimateTravelMinutes(dist, transport)
        // Cap per-segment travel at 180 min (3 hrs) — anything higher is almost certainly wrong
        if (minutes > 180) {
          console.warn(`[route-optimizer] Capping travel ${prev.name} → ${curr.name}: ${minutes} min → 180 min (dist: ${dist.toFixed(1)} km)`)
          minutes = 180
        }
        day.places[pi].travelFromPrevious = {
          duration: formatMinutes(minutes),
          mode: transport.mode,
          emoji: transport.emoji,
        }
      }
    }

    // Recalculate arrival times but NEVER compress below Claude's original.
    // Use whichever is LATER: our calculation or Claude's estimate.
    // This prevents dinner drifting to 4 PM when real distances are shorter
    // than Claude assumed, while still expanding if travel takes longer.
    const firstPlace = day.places[0]
    const firstTime = firstPlace?.arrivalTime ? parseTime(firstPlace.arrivalTime) : null

    if (firstTime) {
      const originalTimes = day.places.map(p => p.arrivalTime)

      let currentTime = firstTime
      for (let pi = 1; pi < day.places.length; pi++) {
        const place = day.places[pi]
        const prevPlace = day.places[pi - 1]
        const stayMin = prevPlace.duration ? parseDurationMinutes(prevPlace.duration) : 60
        const geocodedTravelMin = place.travelFromPrevious
          ? parseDurationMinutes(place.travelFromPrevious.duration)
          : 15

        // Embedded travel: "2-hour drive" — the drive IS the activity
        const durationText = (prevPlace.duration ?? '').toLowerCase()
        const hasEmbeddedTravel = /drive|ride|transfer|commute|travel|ferry/i.test(durationText)

        const totalMin = hasEmbeddedTravel
          ? Math.max(stayMin, geocodedTravelMin)
          : stayMin + geocodedTravelMin

        currentTime = addMinutes(currentTime.hours, currentTime.minutes, totalMin)

        // Use whichever is LATER: calculated or Claude's original
        const orig = originalTimes[pi] ? parseTime(originalTimes[pi]!) : null
        if (orig) {
          const origMin = orig.hours * 60 + orig.minutes
          const calcMin = currentTime.hours * 60 + currentTime.minutes
          if (origMin > calcMin) {
            currentTime = orig // Keep Claude's later time — don't compress
          }
        }

        place.arrivalTime = formatTime(currentTime.hours, currentTime.minutes)
      }
    }
  }

  return out
}
