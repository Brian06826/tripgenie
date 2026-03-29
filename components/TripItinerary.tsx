'use client'

import { useState, useCallback, useEffect } from 'react'
import type { DayPlan } from '@/lib/types'
import { PlaceCard } from './PlaceCard'
import { AlternativesPanel } from './AlternativesPanel'

type VerifyState = 'idle' | 'verifying' | 'done'

export function TripItinerary({
  initialDays,
  tripId,
  alreadyValidated,
}: {
  initialDays: DayPlan[]
  tripId?: string
  alreadyValidated?: boolean
}) {
  const [days, setDays] = useState(initialDays)
  const [swappedKey, setSwappedKey] = useState<string | null>(null)
  const [verifyState, setVerifyState] = useState<VerifyState>(
    alreadyValidated ? 'done' : 'idle'
  )

  // Background validation
  useEffect(() => {
    if (!tripId || alreadyValidated) return

    setVerifyState('verifying')

    fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.trip?.days) {
          setDays(data.trip.days)
        }
        setVerifyState('done')
      })
      .catch(() => {
        setVerifyState('done')
      })
  }, [tripId, alreadyValidated])

  const handleSwap = useCallback((dayIndex: number, placeIndex: number, backupIndex: number) => {
    setDays(prev => {
      const day = prev[dayIndex]
      const place = day.places[placeIndex]
      const backup = place.backupOptions![backupIndex]
      setSwappedKey(`${dayIndex}-${placeIndex}`)
      setTimeout(() => setSwappedKey(null), 2000)
      return prev.map((d, di) => {
        if (di !== dayIndex) return d
        return {
          ...d,
          places: d.places.map((p, pi) => {
            if (pi !== placeIndex) return p
            return {
              ...p,
              name: backup.name,
              nameLocal: backup.nameLocal,
              description: backup.description,
              googleRating: backup.googleRating,
              googleReviewCount: undefined,
              yelpRating: backup.yelpRating,
              yelpReviewCount: undefined,
              priceRange: undefined,
              address: backup.address,
              googleMapsUrl: backup.googleMapsUrl,
              googleReviewsUrl: `https://www.google.com/search?q=${encodeURIComponent(backup.name + ' reviews')}`,
              yelpUrl: backup.yelpUrl,
            }
          }),
        }
      })
    })
  }, [])

  function getVerifyStatus(placeType: string): 'pending' | 'verified' | 'none' {
    if (placeType !== 'restaurant') return 'none'
    if (verifyState === 'verifying') return 'pending'
    if (verifyState === 'done') return 'verified'
    return 'none'
  }

  return (
    <>
      {days.map((day, dayIndex) => (
        <section key={day.dayNumber} className="mb-6">
          <div className="sticky top-0 bg-navy text-white px-4 py-2.5 rounded-lg mb-3 z-10">
            <h2 className="font-bold text-lg">Day {day.dayNumber}</h2>
            <p className="text-sm opacity-80">{day.title}</p>
          </div>

          {day.places.map((place, placeIndex) => {
            const hasAlternatives = (place.backupOptions?.length ?? 0) > 0
            const justSwapped = swappedKey === `${dayIndex}-${placeIndex}`
            return (
              <div key={`${place.name}-${placeIndex}`}>
                {/* Travel time connector */}
                {place.travelFromPrevious && placeIndex > 0 && (
                  <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-gray-400">
                    <div className="h-4 border-l border-dashed border-gray-300" />
                    <span className="bg-gray-50 px-2.5 py-1 rounded-full text-gray-500 font-medium">
                      {place.travelFromPrevious.emoji} {place.travelFromPrevious.duration}
                    </span>
                    <div className="h-4 border-l border-dashed border-gray-300" />
                  </div>
                )}

                <div className={hasAlternatives ? 'lg:grid lg:grid-cols-[1fr_260px] lg:gap-3 lg:items-start' : ''}>
                  <div className={justSwapped ? 'ring-2 ring-orange rounded-xl transition-shadow duration-500' : ''}>
                    <PlaceCard
                      place={place}
                      verifyStatus={getVerifyStatus(place.type)}
                    />
                  </div>
                  {hasAlternatives && (
                    <AlternativesPanel
                      backups={place.backupOptions!}
                      onSwap={(backupIndex) => handleSwap(dayIndex, placeIndex, backupIndex)}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}
