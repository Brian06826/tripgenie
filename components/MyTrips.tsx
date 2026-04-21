'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'
import { cacheTripList, getCachedTripList, removeCachedTrip } from '@/lib/native/offline-cache'

type MyTrip = {
  id: string
  title: string
  destination: string
  days: number
  language: string
  createdAt: string
  heroImageUrl?: string
}

function formatDate(dateStr: string, language?: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const isCN = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'
    return d.toLocaleDateString(isCN ? 'zh-TW' : 'en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

export function MyTrips({ onHasTrips }: { onHasTrips?: (has: boolean) => void } = {}) {
  const { data: session, status } = useSession()
  const [trips, setTrips] = useState<MyTrip[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const { locale } = useUILocale()

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (deletingId) return
    if (!confirm(t(locale, 'myTrips.deleteConfirm'))) return
    setDeletingId(id)
    const prev = trips
    setTrips(curr => {
      const next = curr.filter(tr => tr.id !== id)
      onHasTrips?.(next.length > 0)
      return next
    })
    try {
      const res = await fetch('/api/delete-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('delete failed')
      // Drop the trip from the offline cache too so it doesn't reappear.
      removeCachedTrip(id).catch(() => {})
      cacheTripList(
        prev.filter(tr => tr.id !== id).map(tr => ({
          id: tr.id,
          title: tr.title,
          destination: tr.destination,
          days: tr.days,
          language: tr.language,
          createdAt: tr.createdAt,
          heroImageUrl: tr.heroImageUrl,
        }))
      ).catch(() => {})
    } catch {
      setTrips(prev)
      onHasTrips?.(prev.length > 0)
      alert(t(locale, 'myTrips.deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteAll() {
    if (deletingAll || deletingId) return
    if (!confirm(t(locale, 'myTrips.deleteAllConfirm'))) return
    setDeletingAll(true)
    const prev = trips
    setTrips([])
    onHasTrips?.(false)
    try {
      const res = await fetch('/api/delete-all-trips', { method: 'DELETE' })
      if (!res.ok) throw new Error('delete all failed')
      cacheTripList([]).catch(() => {})
    } catch {
      setTrips(prev)
      onHasTrips?.(prev.length > 0)
      alert(t(locale, 'myTrips.deleteFailed'))
    } finally {
      setDeletingAll(false)
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false

    setLoading(true)

    // Hydrate from offline cache immediately so the list shows even on a
    // failed network. The live fetch below will replace it on success.
    getCachedTripList().then(cached => {
      if (cancelled) return
      if (cached.length > 0 && trips.length === 0) {
        setTrips(cached as MyTrip[])
        onHasTrips?.(cached.length > 0)
        setFromCache(true)
      }
    }).catch(() => {})

    fetch('/api/my-trips')
      .then(res => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        if (data.trips) {
          setTrips(data.trips)
          onHasTrips?.(data.trips.length > 0)
          setFromCache(false)
          // Cache for offline use on next launch.
          cacheTripList(data.trips).catch(() => {})
        }
      })
      .catch(() => {
        // Network failed — keep whatever the cache hydration produced.
        if (cancelled) return
        getCachedTripList().then(cached => {
          if (cancelled || cached.length === 0) return
          setTrips(cached as MyTrip[])
          onHasTrips?.(cached.length > 0)
          setFromCache(true)
        }).catch(() => {})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Don't render if not logged in or no trips
  if (status !== 'authenticated') return null
  if (!loading && trips.length === 0) return null

  return (
    <section className="max-w-xl lg:max-w-3xl mx-auto px-4 pb-4">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
          <span>{t(locale, 'myTrips.title')}</span>
          {fromCache && (
            <span className="text-[10px] font-normal text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              {t(locale, 'offline.viewing')}
            </span>
          )}
        </h2>
        {trips.length > 1 && (
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll || !!deletingId}
            className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {deletingAll ? '...' : t(locale, 'myTrips.deleteAll')}
          </button>
        )}
      </div>

      {loading && trips.length === 0 ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 px-4 py-3 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map(trip => (
            <div
              key={trip.id}
              className={`relative bg-white rounded-xl border border-gray-100 hover:border-orange/40 hover:shadow-sm transition-all overflow-hidden ${deletingId === trip.id ? 'opacity-50' : ''}`}
            >
              <a href={`/trip/${trip.id}`} className="block">
                <div className="flex items-center">
                  {trip.heroImageUrl && (
                    <div className="w-16 h-16 shrink-0">
                      <img
                        src={trip.heroImageUrl}
                        alt={trip.destination}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {trip.destination}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{trip.title}</p>
                      </div>
                      <div className="flex-shrink-0 text-right pr-10">
                        <p className="text-xs font-medium text-gray-700">
                          {trip.days} {locale === 'en' ? `day${trip.days !== 1 ? 's' : ''}` : '日'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(trip.createdAt, trip.language)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
              <button
                type="button"
                onClick={e => handleDelete(e, trip.id)}
                disabled={deletingId === trip.id}
                aria-label={t(locale, 'myTrips.delete')}
                title={t(locale, 'myTrips.delete')}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
