import type { Trip } from './types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const TRIP_PREFIX = 'trip:'

// File-based fallback for local dev without Vercel KV.
// Next.js 16 (Turbopack) runs route handlers and server components in separate
// V8 contexts, so in-memory stores (even globalThis) are not shared. A file on
// disk is the only reliable cross-context store in dev.
const DEV_STORE_DIR = join(process.cwd(), '.next', 'dev-trips')

function devRead(key: string): string | null {
  const file = join(DEV_STORE_DIR, `${key.replace(/[^a-z0-9_-]/gi, '_')}.json`)
  if (!existsSync(file)) return null
  return readFileSync(file, 'utf8')
}

function devWrite(key: string, value: string): void {
  if (!existsSync(DEV_STORE_DIR)) mkdirSync(DEV_STORE_DIR, { recursive: true })
  const file = join(DEV_STORE_DIR, `${key.replace(/[^a-z0-9_-]/gi, '_')}.json`)
  writeFileSync(file, value, 'utf8')
}

export async function saveTrip(id: string, trip: Trip): Promise<void> {
  if (!process.env.KV_REST_API_URL) {
    devWrite(`${TRIP_PREFIX}${id}`, JSON.stringify(trip))
    return
  }
  const { kv } = await import('@vercel/kv')
  await kv.set(`${TRIP_PREFIX}${id}`, JSON.stringify(trip))
}

export async function getTrip(id: string): Promise<Trip | null> {
  if (!process.env.KV_REST_API_URL) {
    const raw = devRead(`${TRIP_PREFIX}${id}`)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Trip
    } catch {
      return null
    }
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
