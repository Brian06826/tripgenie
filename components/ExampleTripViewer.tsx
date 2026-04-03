'use client'

import { useEffect, useState } from 'react'
import type { Trip } from '@/lib/types'
import { TripItinerary } from '@/components/TripItinerary'
import { TripMap } from '@/components/TripMap'
import { ShareButton } from '@/components/ShareButton'

export function ExampleTripViewer({ trip }: { trip: Trip }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1500)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return <TripSkeleton />

  const tripUrl = `/trip/${trip.id}`

  return (
    <div className="min-h-screen bg-gray-50 animate-in fade-in duration-500">
      {/* Header */}
      <header className="relative text-white px-4 pt-8 pb-6">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, var(--color-navy) 0%, var(--color-navy-mid) 100%)' }}
          />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <p className="text-xs text-orange font-semibold mb-1">Lulgo</p>
          <h1 className="text-2xl font-bold leading-tight mb-1">{trip.title}</h1>
          <p className="text-sm opacity-80 mb-4">
            {trip.destination} · {trip.days.length} day{trip.days.length !== 1 ? 's' : ''}
          </p>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center justify-between gap-3">
            <span className="text-xs opacity-90 truncate font-mono">
              lulgo.com{tripUrl}
            </span>
            <ShareButton tripId={trip.id} tripTitle={trip.title} language={trip.language} trip={trip} />
          </div>
        </div>
      </header>

      {/* Day content */}
      <main className="max-w-4xl mx-auto px-4 py-4">
        <TripMap days={trip.days} />
        <TripItinerary initialDays={trip.days} validated={false} destination={trip.destination} language={trip.language} />
        <div className="mt-6 mb-4">
          <a
            href={`/?dest=${encodeURIComponent(trip.destination)}&days=${trip.days.length}`}
            className="flex items-center justify-center w-full bg-orange text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
          >
            {trip.language === 'zh-TW' || trip.language === 'zh-HK' || trip.language === 'zh-CN'
              ? `✨ 規劃類似行程 → ${trip.destination}`
              : `✨ Plan a trip like this → ${trip.destination}`
            }
          </a>
        </div>
        <footer className="text-center text-xs text-gray-400 py-8">
          Made with <a href="/" className="text-orange underline">Lulgo</a>
        </footer>
      </main>
    </div>
  )
}

function TripSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="relative px-4 pt-8 pb-6" style={{ background: 'linear-gradient(180deg, #1a2744 0%, #243558 100%)' }}>
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="h-3 w-16 bg-white/30 rounded animate-pulse" />
          <div className="h-6 w-52 bg-white/30 rounded animate-pulse" />
          <div className="h-3 w-28 bg-white/20 rounded animate-pulse" />
          <div className="mt-4 h-11 bg-white/15 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-4 py-4 space-y-3">
        <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
            <div className="h-3 w-20 bg-orange/25 rounded animate-pulse" />
            <div className="h-5 w-44 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="space-y-1.5 pt-1">
              <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="flex-1 h-11 bg-blue-50 rounded-lg animate-pulse" />
              <div className="flex-1 h-11 bg-blue-50 rounded-lg animate-pulse" />
              <div className="flex-1 h-11 bg-red-50 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
