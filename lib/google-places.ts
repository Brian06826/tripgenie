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
}

// ---------------------------------------------------------------------------
// Low-level API calls
// ---------------------------------------------------------------------------

async function findPlace(query: string, apiKey: string): Promise<PlaceResult | null> {
  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id,name,formatted_address,business_status,rating,user_ratings_total,price_level',
    key: apiKey,
  })

  const res = await fetch(`${PLACES_API}/findplacefromtext/json?${params}`)
  if (!res.ok) return null

  const data = await res.json()
  return data.status === 'OK' && data.candidates?.length ? data.candidates[0] : null
}

async function textSearch(query: string, apiKey: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    query,
    type: 'restaurant',
    key: apiKey,
  })

  const res = await fetch(`${PLACES_API}/textsearch/json?${params}`)
  if (!res.ok) return []

  const data = await res.json()
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
        const found = await findPlace(`${place.name} ${dest}`, apiKey)

        if (!found) {
          return { di, pi, valid: false, reason: 'not_found' }
        }
        if (found.business_status === 'CLOSED_PERMANENTLY') {
          return { di, pi, valid: false, reason: 'closed' }
        }
        if (!isInCity(found.formatted_address, dest)) {
          return { di, pi, valid: false, reason: 'wrong_city' }
        }

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
    // Fetch a pool of real, open restaurants in the destination
    let pool: PlaceResult[] = []
    try {
      pool = await textSearch(`best restaurants in ${dest}`, apiKey)
    } catch (err) {
      console.error('[Google Places] Failed to fetch replacement pool:', err)
    }

    for (const f of failures) {
      const replacement = pool.find(r =>
        r.business_status !== 'CLOSED_PERMANENTLY' &&
        !usedNames.has(r.name.toLowerCase()) &&
        isInCity(r.formatted_address ?? '', dest)
      )

      if (replacement) {
        const place = out.days[f.di].places[f.pi]
        console.log(`[Google Places] Replacing "${place.name}" → "${replacement.name}" (${f.reason}) in ${dest}`)

        usedNames.add(replacement.name.toLowerCase())
        pool.splice(pool.indexOf(replacement), 1)

        place.name = replacement.name
        place.nameLocal = undefined
        place.description = `Popular local restaurant in ${dest}.`
        place.googleRating = replacement.rating
        place.googleReviewCount = replacement.user_ratings_total
        place.priceRange = priceLevelToRange(replacement.price_level)
        // Keep: arrivalTime, duration, type, tips
        // Clear backups — they were chosen for the old restaurant
        place.backupOptions = undefined
      } else {
        const place = out.days[f.di].places[f.pi]
        console.warn(`[Google Places] No replacement found for "${place.name}" in ${dest}`)
        // Keep the original — better than nothing
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
