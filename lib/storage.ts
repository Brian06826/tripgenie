import type { Trip } from './types'

const TRIP_PREFIX = 'trip:'

// In-memory fallback for local dev without Vercel KV.
// Anchored to globalThis so it survives Next.js hot-module reloads and
// is shared across the API route and page route module instances in dev.
const g = globalThis as typeof globalThis & { __tripMemStore?: Map<string, string> }
if (!g.__tripMemStore) g.__tripMemStore = new Map()
const memStore = g.__tripMemStore

export async function saveTrip(id: string, trip: Trip): Promise<void> {
  if (!process.env.KV_REST_API_URL) {
    memStore.set(`${TRIP_PREFIX}${id}`, JSON.stringify(trip))
    return
  }
  const { kv } = await import('@vercel/kv')
  await kv.set(`${TRIP_PREFIX}${id}`, JSON.stringify(trip))
}

export async function getTrip(id: string): Promise<Trip | null> {
  if (!process.env.KV_REST_API_URL) {
    const raw = memStore.get(`${TRIP_PREFIX}${id}`)
    return raw ? JSON.parse(raw) : null
  }
  const { kv } = await import('@vercel/kv')
  const raw = await kv.get<string>(`${TRIP_PREFIX}${id}`)
  if (!raw) return null
  try {
    return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as Trip
  } catch {
    return null
  }
}
