'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { DayPlan } from '@/lib/types'
import { PlaceCard } from './PlaceCard'
import { AlternativesPanel } from './AlternativesPanel'

export function TripItinerary({
  initialDays,
  validated = true,
  showYelp = true,
  destination,
  language,
}: {
  initialDays: DayPlan[]
  validated?: boolean
  showYelp?: boolean
  destination?: string
  language?: string
}) {
  const [days, setDays] = useState(initialDays)
  const [swappedKey, setSwappedKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState(0)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const tabBarRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  // Track which day section is visible
  useEffect(() => {
    if (days.length <= 1) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLElement)
            if (idx >= 0) setActiveDay(idx)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    for (const ref of sectionRefs.current) {
      if (ref) observer.observe(ref)
    }
    return () => observer.disconnect()
  }, [days.length])

  function scrollToDay(idx: number) {
    const el = sectionRefs.current[idx]
    if (!el) return
    isScrollingRef.current = true
    setActiveDay(idx)
    const tabBarHeight = tabBarRef.current?.offsetHeight ?? 44
    const top = el.getBoundingClientRect().top + window.scrollY - tabBarHeight - 8
    window.scrollTo({ top, behavior: 'smooth' })
    setTimeout(() => { isScrollingRef.current = false }, 600)
  }

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

  const handleEdit = useCallback(async (dayIndex: number, placeIndex: number, instruction: string) => {
    if (!destination) return
    const key = `${dayIndex}-${placeIndex}`
    setEditingKey(key)

    try {
      const currentPlace = days[dayIndex].places[placeIndex]
      const res = await fetch('/api/edit-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          currentPlace,
          destination,
          language: language ?? 'en',
        }),
      })

      if (!res.ok) throw new Error('Edit failed')

      const result = await res.json()

      if (result.removed) {
        // Remove the place from the day
        setDays(prev => prev.map((d, di) => {
          if (di !== dayIndex) return d
          return { ...d, places: d.places.filter((_, pi) => pi !== placeIndex) }
        }))
      } else if (result.place) {
        // Replace the place
        setDays(prev => prev.map((d, di) => {
          if (di !== dayIndex) return d
          return {
            ...d,
            places: d.places.map((p, pi) => {
              if (pi !== placeIndex) return p
              return {
                ...p,
                name: result.place.name,
                nameLocal: result.place.nameLocal,
                type: result.place.type,
                description: result.place.description,
                arrivalTime: result.place.arrivalTime ?? p.arrivalTime,
                duration: result.place.duration ?? p.duration,
                googleRating: result.place.googleRating,
                googleReviewCount: undefined,
                yelpRating: result.place.yelpRating,
                yelpReviewCount: undefined,
                tips: result.place.tips,
                priceRange: result.place.priceRange,
                parking: undefined,
                backupOptions: undefined,
                googleMapsUrl: result.place.googleMapsUrl,
                googleReviewsUrl: result.place.googleReviewsUrl,
                yelpUrl: result.place.yelpUrl,
              }
            }),
          }
        }))
        setSwappedKey(key)
        setTimeout(() => setSwappedKey(null), 2000)
      }
    } catch (err) {
      console.error('[edit] Failed:', err)
    } finally {
      setEditingKey(null)
    }
  }, [days, destination, language])

  return (
    <>
      {/* Sticky day tabs — only show for multi-day trips */}
      {days.length > 1 && (
        <div
          ref={tabBarRef}
          className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 -mx-4 px-4 py-2 mb-3 flex gap-1.5 overflow-x-auto scrollbar-hide"
        >
          {days.map((day, i) => (
            <button
              key={day.dayNumber}
              onClick={() => scrollToDay(i)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeDay === i
                  ? 'bg-orange text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-orange hover:text-orange'
              }`}
            >
              Day {day.dayNumber}
            </button>
          ))}
        </div>
      )}

      {days.map((day, dayIndex) => (
        <section
          key={day.dayNumber}
          ref={(el) => { sectionRefs.current[dayIndex] = el }}
          className="mb-6"
        >
          <div className="sticky top-[52px] bg-navy text-white px-4 py-2.5 rounded-lg mb-3 z-10">
            <h2 className="font-bold text-lg">Day {day.dayNumber}</h2>
            <p className="text-sm opacity-80">{day.title}</p>
          </div>

          {day.places.map((place, placeIndex) => {
            const hasAlternatives = (place.backupOptions?.length ?? 0) > 0
            const key = `${dayIndex}-${placeIndex}`
            const justSwapped = swappedKey === key
            const isEditing = editingKey === key
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
                      verifyStatus={place.type === 'restaurant' && validated ? 'verified' : 'none'}
                      showYelp={showYelp}
                      onEdit={destination ? (instruction) => handleEdit(dayIndex, placeIndex, instruction) : undefined}
                      editLoading={isEditing}
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
