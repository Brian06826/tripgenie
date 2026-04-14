// Offline trip cache via Capacitor Preferences.
//
// Preferences works on both native (UserDefaults / SharedPreferences) and on
// the web (localStorage fallback), so callers don't need to gate by platform.
// All operations are best-effort: failures are swallowed so the UI never
// breaks because the cache is unavailable.
import type { Trip } from '@/lib/types'

const TRIP_KEY = (id: string) => `lulgo.cache.trip.${id}`
const TRIP_LIST_KEY = 'lulgo.cache.tripList'
const TRIP_INDEX_KEY = 'lulgo.cache.tripIndex'

export type CachedTripSummary = {
  id: string
  title: string
  destination: string
  days: number
  language: string
  createdAt: string
  heroImageUrl?: string
}

// Capacitor plugin proxies are thenable — returning one directly from an
// async function causes `await` to call `.then()`, which throws on web
// ("Preferences.then() is not implemented on web"). Wrapping in a plain
// object prevents the Promise resolution from unwrapping the thenable.
let _prefsPromise: Promise<{ api: any } | null> | null = null

function prefs(): Promise<{ api: any } | null> {
  if (!_prefsPromise) {
    _prefsPromise = import('@capacitor/preferences')
      .then(mod => ({ api: mod.Preferences }))
      .catch(() => null)
  }
  return _prefsPromise
}

async function setItem(key: string, value: string) {
  const wrapper = await prefs()
  if (!wrapper) return
  try { await wrapper.api.set({ key, value }) } catch {}
}

async function getItem(key: string): Promise<string | null> {
  const wrapper = await prefs()
  if (!wrapper) return null
  try {
    const r = await wrapper.api.get({ key })
    return r.value ?? null
  } catch {
    return null
  }
}

async function removeItem(key: string) {
  const wrapper = await prefs()
  if (!wrapper) return
  try { await wrapper.api.remove({ key }) } catch {}
}

/** Cache a full trip's JSON for offline viewing. */
export async function cacheTrip(trip: Trip): Promise<void> {
  if (!trip?.id) return
  await setItem(TRIP_KEY(trip.id), JSON.stringify({
    trip,
    cachedAt: Date.now(),
  }))
  // Track which trip IDs we've cached so we can prune / list them.
  const idx = await getCachedTripIndex()
  if (!idx.includes(trip.id)) {
    idx.push(trip.id)
    await setItem(TRIP_INDEX_KEY, JSON.stringify(idx))
  }
}

/** Read a previously cached trip. Returns null if missing or corrupt. */
export async function getCachedTrip(id: string): Promise<Trip | null> {
  const raw = await getItem(TRIP_KEY(id))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { trip: Trip; cachedAt: number }
    return parsed.trip ?? null
  } catch {
    return null
  }
}

/** Remove a trip from the cache (e.g. after the user deletes it). */
export async function removeCachedTrip(id: string): Promise<void> {
  await removeItem(TRIP_KEY(id))
  const idx = await getCachedTripIndex()
  const next = idx.filter(x => x !== id)
  if (next.length !== idx.length) {
    await setItem(TRIP_INDEX_KEY, JSON.stringify(next))
  }
}

async function getCachedTripIndex(): Promise<string[]> {
  const raw = await getItem(TRIP_INDEX_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Cache the My Trips list summary so the home screen works offline. */
export async function cacheTripList(list: CachedTripSummary[]): Promise<void> {
  await setItem(TRIP_LIST_KEY, JSON.stringify({ list, cachedAt: Date.now() }))
}

/** Read the cached My Trips list. Returns [] if missing. */
export async function getCachedTripList(): Promise<CachedTripSummary[]> {
  const raw = await getItem(TRIP_LIST_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { list: CachedTripSummary[] }
    return Array.isArray(parsed.list) ? parsed.list : []
  } catch {
    return []
  }
}
