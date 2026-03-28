#!/usr/bin/env npx tsx
/**
 * Seed script — generates 2 example trips via the Claude API and saves them
 * to Redis with fixed IDs. Run once after setting REDIS_URL and ANTHROPIC_API_KEY.
 *
 *   npm run seed
 */

import 'dotenv/config'
import { generateTrip } from '../lib/claude'
import { saveTrip } from '../lib/storage'
import { buildGoogleMapsUrl, buildGoogleReviewsUrl, buildYelpUrl } from '../lib/url-helpers'
import type { Trip } from '../lib/types'
import { nanoid } from 'nanoid'

const EXAMPLES = [
  {
    id: 'example-longbeach',
    prompt:
      'Long Beach 1-day couple trip. Focus on highly-rated restaurants, scenic waterfront spots, and charming neighbourhoods like Belmont Shore. Great photos, romantic dinner.',
  },
  {
    id: 'example-sandiego',
    prompt:
      'San Diego 5-day trip. Include SeaWorld, fresh seafood restaurants, Old Town, Balboa Park, and La Jolla cove. Mix of popular attractions and local food gems.',
  },
]

async function main() {
  console.log('🌱  Seeding example trips…\n')

  for (const example of EXAMPLES) {
    console.log(`→ Generating "${example.id}" …`)
    const generation = await generateTrip(example.prompt)

    // Add server-side URLs (same logic as the generate API route)
    const days = generation.days.map(day => ({
      ...day,
      places: day.places.map(place => ({
        ...place,
        googleMapsUrl: buildGoogleMapsUrl(place.name, generation.destination),
        googleReviewsUrl: buildGoogleReviewsUrl(place.name, generation.destination),
        yelpUrl: buildYelpUrl(place.name, generation.destination),
        backupOptions: place.backupOptions?.map(b => ({
          ...b,
          googleMapsUrl: buildGoogleMapsUrl(b.name, generation.destination),
          yelpUrl: buildYelpUrl(b.name, generation.destination),
        })),
      })),
    }))

    const trip: Trip = {
      ...generation,
      id: example.id,
      createdAt: new Date().toISOString(),
      days,
    }

    await saveTrip(example.id, trip)
    console.log(`   ✓ Saved "${trip.title}" → /trip/${example.id}\n`)
  }

  console.log('✅  Done! Example trips are live.')
  process.exit(0)
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
