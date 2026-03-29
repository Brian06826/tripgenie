'use client'

import { useCallback, useEffect, useState } from 'react'
import { getRecentTrips, removeRecentTrip, clearRecentTrips, type RecentTrip } from '@/lib/recent-trips'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  if (isNaN(then)) return ''
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  return `${Math.floor(diffDay / 30)} month${Math.floor(diffDay / 30) !== 1 ? 's' : ''} ago`
}

export function RecentTrips() {
  const [trips, setTrips] = useState<RecentTrip[]>([])

  const reload = useCallback(() => setTrips(getRecentTrips()), [])

  // Load on mount
  useEffect(() => { reload() }, [reload])

  // Re-load when page becomes visible again (browser back button uses bfcache,
  // which restores the page without re-running useEffect — so we need this)
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) reload()
    }
    function onVisChange() {
      if (document.visibilityState === 'visible') reload()
    }
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisChange)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisChange)
    }
  }, [reload])

  if (trips.length === 0) return null

  function handleRemove(id: string) {
    removeRecentTrip(id)
    setTrips(getRecentTrips())
  }

  function handleClearAll() {
    clearRecentTrips()
    setTrips([])
  }

  return (
    <section className="max-w-xl mx-auto px-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Your Recent Trips / 你最近嘅行程
        </h2>
        <button
          onClick={handleClearAll}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Clear All
        </button>
      </div>
      <div className="space-y-2">
        {trips.map(trip => (
          <div key={trip.id} className="relative group">
            <a
              href={trip.url}
              className="block bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-orange/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-6">
                  <p className="text-sm font-semibold text-gray-900 truncate">{trip.destination}</p>
                  <p className="text-xs text-gray-500 truncate">{trip.title}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-medium text-gray-700">{trip.days} day{trip.days !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-400">{timeAgo(trip.createdAt)}</p>
                </div>
              </div>
            </a>
            <button
              onClick={(e) => { e.preventDefault(); handleRemove(trip.id) }}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Remove trip"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
