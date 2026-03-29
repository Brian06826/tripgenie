const STORAGE_KEY = 'tripgenie_recent_trips'
const MAX_TRIPS = 10

export interface RecentTrip {
  id: string
  title: string
  destination: string
  days: number
  createdAt: string
  url: string
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null // private browsing or blocked
  }
}

export function getRecentTrips(): RecentTrip[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveRecentTrip(trip: RecentTrip): void {
  const storage = getStorage()
  if (!storage) return
  try {
    const existing = getRecentTrips().filter(t => t.id !== trip.id)
    const updated = [trip, ...existing].slice(0, MAX_TRIPS)
    storage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // quota exceeded or other error — fail silently
  }
}

export function removeRecentTrip(id: string): void {
  const storage = getStorage()
  if (!storage) return
  try {
    const updated = getRecentTrips().filter(t => t.id !== id)
    storage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {}
}

export function clearRecentTrips(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {}
}
