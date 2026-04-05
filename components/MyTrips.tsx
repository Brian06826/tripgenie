'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

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

export function MyTrips() {
  const { data: session, status } = useSession()
  const [trips, setTrips] = useState<MyTrip[]>([])
  const [loading, setLoading] = useState(false)
  const { locale } = useUILocale()

  useEffect(() => {
    if (status !== 'authenticated') return

    setLoading(true)
    fetch('/api/my-trips')
      .then(res => res.json())
      .then(data => {
        if (data.trips) setTrips(data.trips)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status])

  // Don't render if not logged in or no trips
  if (status !== 'authenticated') return null
  if (!loading && trips.length === 0) return null

  return (
    <section className="max-w-xl lg:max-w-3xl mx-auto px-4 pb-4">
      <h2 className="text-sm font-semibold text-gray-500 mb-2.5">
        {t(locale, 'myTrips.title')}
      </h2>

      {loading ? (
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
            <a
              key={trip.id}
              href={`/trip/${trip.id}`}
              className="block bg-white rounded-xl border border-gray-100 hover:border-orange/40 hover:shadow-sm transition-all overflow-hidden"
            >
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
                    <div className="flex-shrink-0 text-right">
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
          ))}
        </div>
      )}
    </section>
  )
}
