import type { TripGeneration } from './types'

// ---------------------------------------------------------------------------
// Google Places API — restaurant validation & replacement
// ---------------------------------------------------------------------------

const PLACES_API = 'https://maps.googleapis.com/maps/api/place'

interface PlaceResult {
  place_id: string
  name: string
  formatted_address: string
  business_status?: string
  rating?: number
  user_ratings_total?: number
  price_level?: number
  geometry?: { location: { lat: number; lng: number } }
}

// ---------------------------------------------------------------------------
// Low-level API calls
// ---------------------------------------------------------------------------

async function findPlace(query: string, apiKey: string): Promise<PlaceResult | null> {
  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id,name,formatted_address,business_status,rating,user_ratings_total,price_level,geometry',
    key: apiKey,
  })

  const res = await fetch(`${PLACES_API}/findplacefromtext/json?${params}`)
  if (!res.ok) {
    console.error(`[Google Places] findPlace HTTP ${res.status} for "${query}"`)
    return null
  }

  const data = await res.json()
  if (data.status !== 'OK') {
    if (data.status !== 'ZERO_RESULTS') {
      console.error(`[Google Places] findPlace status=${data.status} for "${query}": ${data.error_message ?? ''}`)
    }
    return null
  }
  return data.candidates?.length ? data.candidates[0] : null
}

async function textSearch(query: string, apiKey: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    query,
    type: 'restaurant',
    key: apiKey,
  })

  const res = await fetch(`${PLACES_API}/textsearch/json?${params}`)
  if (!res.ok) {
    console.error(`[Google Places] textSearch HTTP ${res.status} for "${query}"`)
    return []
  }

  const data = await res.json()
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error(`[Google Places] textSearch status=${data.status} for "${query}": ${data.error_message ?? ''}`)
  }
  return data.status === 'OK' ? (data.results ?? []) : []
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Heuristic: does the Google address contain the destination city name? */
function isInCity(address: string, destination: string): boolean {
  const addr = address.toLowerCase()
  const dest = destination.toLowerCase()

  // Full match: "Long Beach" in "123 Main St, Long Beach, CA"
  if (addr.includes(dest)) return true

  // Word match: every significant word (>3 chars) appears in the address
  const words = dest.split(/[\s,]+/).filter(w => w.length > 3)
  return words.length > 0 && words.every(w => addr.includes(w))
}

function priceLevelToRange(level?: number): string | undefined {
  if (level == null) return undefined
  return ['$', '$', '$$', '$$$', '$$$$'][level]
}

// ---------------------------------------------------------------------------
// Public: validate and fix restaurants in a generated itinerary
// ---------------------------------------------------------------------------

type ValidationEntry = {
  di: number
  pi: number
  valid: boolean
  reason?: 'not_found' | 'closed' | 'wrong_city'
  rating?: number
  reviewCount?: number
}

/**
 * Validates every restaurant in the itinerary against Google Places API.
 * - If valid: updates googleRating + googleReviewCount with real data.
 * - If invalid (not found / permanently closed / wrong city): replaces
 *   with a top-rated open restaurant from the same destination.
 *
 * Gracefully no-ops when GOOGLE_PLACES_API_KEY is not set.
 */
export async function validateRestaurants(generation: TripGeneration): Promise<TripGeneration> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.warn('[Google Places] API key not set — skipping restaurant validation')
    return generation
  }

  const dest = generation.destination

  // Collect every name already in the itinerary (main + backup) to avoid dupes
  const usedNames = new Set<string>()
  for (const day of generation.days) {
    for (const p of day.places) {
      usedNames.add(p.name.toLowerCase())
      for (const b of p.backupOptions ?? []) usedNames.add(b.name.toLowerCase())
    }
  }

  // Find all restaurant slots
  const refs: { di: number; pi: number }[] = []
  for (let di = 0; di < generation.days.length; di++) {
    for (let pi = 0; pi < generation.days[di].places.length; pi++) {
      if (generation.days[di].places[pi].type === 'restaurant') {
        refs.push({ di, pi })
      }
    }
  }

  if (refs.length === 0) return generation

  // ------ Phase 1: validate all restaurants in parallel ------
  const validations: ValidationEntry[] = await Promise.all(
    refs.map(async ({ di, pi }): Promise<ValidationEntry> => {
      const place = generation.days[di].places[pi]
      try {
        const found = await findPlace(`${place.name} restaurant ${dest}`, apiKey)

        if (!found) {
          console.log(`[Google Places] FAIL "${place.name}" — not found on Google`)
          return { di, pi, valid: false, reason: 'not_found' }
        }

        const status = found.business_status ?? ''
        if (status === 'CLOSED_PERMANENTLY' || status === 'CLOSED_TEMPORARILY') {
          console.log(`[Google Places] FAIL "${place.name}" — ${status} (Google name: "${found.name}")`)
          return { di, pi, valid: false, reason: 'closed' }
        }

        if (!isInCity(found.formatted_address, dest)) {
          console.log(`[Google Places] FAIL "${place.name}" — wrong city (address: ${found.formatted_address})`)
          return { di, pi, valid: false, reason: 'wrong_city' }
        }

        console.log(`[Google Places] PASS "${place.name}" — rating: ${found.rating ?? 'N/A'}, reviews: ${found.user_ratings_total ?? 'N/A'}, status: ${status || 'OPERATIONAL'}`)
        return {
          di, pi,
          valid: true,
          rating: found.rating,
          reviewCount: found.user_ratings_total,
        }
      } catch (err) {
        console.error(`[Google Places] Validation error for "${place.name}":`, err)
        return { di, pi, valid: true } // on API error, keep original
      }
    })
  )

  // Deep-clone so we don't mutate the original
  const out: TripGeneration = JSON.parse(JSON.stringify(generation))

  // Apply real Google ratings to every valid restaurant
  for (const v of validations) {
    if (v.valid && v.rating != null) {
      const place = out.days[v.di].places[v.pi]
      place.googleRating = v.rating
      place.googleReviewCount = v.reviewCount
    }
  }

  // ------ Phase 2: replace invalid restaurants (sequential to avoid dupes) ------
  const failures = validations.filter(v => !v.valid)

  if (failures.length > 0) {
    // Fetch a general pool + cuisine-specific pools for better replacements
    const poolCache = new Map<string, PlaceResult[]>()

    async function getPool(query: string): Promise<PlaceResult[]> {
      if (poolCache.has(query)) return poolCache.get(query)!
      try {
        const results = await textSearch(query, apiKey!)
        poolCache.set(query, results)
        return results
      } catch (err) {
        console.error(`[Google Places] Failed to fetch pool for "${query}":`, err)
        return []
      }
    }

    // Pre-fetch general pool
    await getPool(`best restaurants in ${dest}`)

    for (const f of failures) {
      const place = out.days[f.di].places[f.pi]

      // Try cuisine-specific search first based on the original description
      const desc = (place.description ?? '').toLowerCase()
      const cuisineHints = ['seafood', 'mexican', 'italian', 'japanese', 'chinese',
        'thai', 'korean', 'vietnamese', 'indian', 'french', 'american', 'bbq',
        'sushi', 'ramen', 'pizza', 'burger', 'taco', 'steak', 'brunch', 'breakfast',
        'cafe', 'bakery', 'dim sum', 'noodle', 'pho', 'curry']
      const cuisine = cuisineHints.find(c => desc.includes(c) || place.name.toLowerCase().includes(c))

      // Search cuisine-specific pool first, fall back to general
      const pools = cuisine
        ? [await getPool(`best ${cuisine} restaurant in ${dest}`), poolCache.get(`best restaurants in ${dest}`) ?? []]
        : [poolCache.get(`best restaurants in ${dest}`) ?? []]

      let replacement: PlaceResult | undefined
      for (const pool of pools) {
        replacement = pool.find(r =>
          r.business_status !== 'CLOSED_PERMANENTLY' &&
          r.business_status !== 'CLOSED_TEMPORARILY' &&
          !usedNames.has(r.name.toLowerCase()) &&
          isInCity(r.formatted_address ?? '', dest)
        )
        if (replacement) break
      }

      if (replacement) {
        console.log(`[Google Places] Replacing "${place.name}" → "${replacement.name}" (reason: ${f.reason}${cuisine ? `, cuisine: ${cuisine}` : ''})`)

        usedNames.add(replacement.name.toLowerCase())

        place.name = replacement.name
        place.nameLocal = undefined
        place.description = `Popular ${cuisine ?? 'local'} restaurant in ${dest}.`
        place.googleRating = replacement.rating
        place.googleReviewCount = replacement.user_ratings_total
        place.priceRange = priceLevelToRange(replacement.price_level)
        place.backupOptions = undefined
      } else {
        console.warn(`[Google Places] No replacement found for "${place.name}" in ${dest}`)
      }
    }
  }

  const validCount = validations.filter(v => v.valid).length
  const replacedCount = failures.filter(f => {
    const place = out.days[f.di].places[f.pi]
    return !generation.days[f.di].places[f.pi] ||
      place.name !== generation.days[f.di].places[f.pi].name
  }).length
  console.log(`[Google Places] Validated ${refs.length} restaurants: ${validCount} OK, ${failures.length} failed, ${replacedCount} replaced`)

  return out
}

// ---------------------------------------------------------------------------
// Public: geocode all places (returns lat/lng for route optimization)
// ---------------------------------------------------------------------------

export interface GeocodedPlace {
  dayIndex: number
  placeIndex: number
  lat: number
  lng: number
}

/**
 * Geocodes every place in the itinerary using Google Places findPlace.
 * Restaurants that were already validated will already have geometry data
 * cached from the validation step — this function fills in attractions,
 * hotels, and other place types.
 *
 * Returns an array of geocoded coordinates keyed by day/place index.
 */
export async function geocodeAllPlaces(generation: TripGeneration): Promise<GeocodedPlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return []

  const dest = generation.destination
  const results: GeocodedPlace[] = []

  const tasks: Promise<void>[] = []
  for (let di = 0; di < generation.days.length; di++) {
    for (let pi = 0; pi < generation.days[di].places.length; pi++) {
      const place = generation.days[di].places[pi]
      tasks.push(
        (async () => {
          try {
            const typeHint = place.type === 'restaurant' ? 'restaurant'
              : place.type === 'hotel' ? 'hotel'
              : place.type === 'attraction' ? 'attraction'
              : ''
            const found = await findPlace(`${place.name} ${typeHint} ${dest}`.trim(), apiKey)
            if (found?.geometry?.location) {
              results.push({
                dayIndex: di,
                placeIndex: pi,
                lat: found.geometry.location.lat,
                lng: found.geometry.location.lng,
              })
            }
          } catch (err) {
            console.error(`[Geocode] Failed for "${place.name}":`, err)
          }
        })()
      )
    }
  }

  await Promise.all(tasks)
  return results
}
