'use client'

import { useState } from 'react'
import type { DayPlan } from '@/lib/types'
import { PlaceCard } from './PlaceCard'
import { AlternativesPanel } from './AlternativesPanel'

export function TripItinerary({ initialDays }: { initialDays: DayPlan[] }) {
  const [days, setDays] = useState(initialDays)

  function handleSwap(dayIndex: number, placeIndex: number, backupIndex: number) {
    setDays(prev =>
      prev.map((day, di) => {
        if (di !== dayIndex) return day
        return {
          ...day,
          places: day.places.map((place, pi) => {
            if (pi !== placeIndex) return place
            const backup = place.backupOptions![backupIndex]
            return {
              ...place,
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
              yelpUrl: backup.yelpUrl,
            }
          }),
        }
      })
    )
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
            return (
              <div
                key={place.name}
                className={hasAlternatives ? 'lg:grid lg:grid-cols-[1fr_260px] lg:gap-3 lg:items-start' : ''}
              >
                <PlaceCard place={place} />
                {hasAlternatives && (
                  <AlternativesPanel
                    backups={place.backupOptions!}
                    onSwap={(backupIndex) => handleSwap(dayIndex, placeIndex, backupIndex)}
                  />
                )}
              </div>
            )
          })}
        </section>
      ))}
    </>
  )
}
