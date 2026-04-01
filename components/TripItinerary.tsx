'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { DayPlan } from '@/lib/types'
import { PlaceCard } from './PlaceCard'
import { AlternativesPanel } from './AlternativesPanel'
import { HotelSuggestion, getDayCity } from './HotelSuggestion'

// Yelp is useful for US destinations only
const US_SIGNALS = [
  // US states (abbreviations and full names that commonly appear in destination strings)
  'usa', 'united states',
  // Major US cities / regions
  'los angeles', 'la ', 'san francisco', 'new york', 'nyc', 'manhattan', 'brooklyn',
  'chicago', 'houston', 'phoenix', 'san diego', 'dallas', 'austin', 'san antonio',
  'seattle', 'portland', 'denver', 'boston', 'miami', 'orlando', 'tampa',
  'atlanta', 'nashville', 'las vegas', 'honolulu', 'hawaii', 'maui',
  'long beach', 'pasadena', 'santa monica', 'beverly hills', 'hollywood',
  'anaheim', 'irvine', 'san jose', 'oakland', 'sacramento',
  'philadelphia', 'pittsburgh', 'detroit', 'minneapolis', 'st louis',
  'new orleans', 'charlotte', 'raleigh', 'jacksonville', 'memphis',
  'salt lake city', 'tucson', 'scottsdale', 'albuquerque',
  'washington dc', 'washington d.c.',
  // US states
  'california', 'texas', 'florida', 'nevada', 'arizona', 'colorado',
  'oregon', 'washington state', 'new jersey', 'massachusetts',
  'illinois', 'georgia', 'tennessee', 'louisiana', 'carolina',
  'virginia', 'maryland', 'connecticut', 'utah', 'montana', 'alaska',
]

function isUSDestination(destination?: string): boolean {
  if (!destination) return true // default to showing Yelp
  const dest = destination.toLowerCase()
  return US_SIGNALS.some(signal => dest.includes(signal))
}

function formatDayDate(startDate: string, dayIndex: number, language?: string): string | null {
  try {
    const date = new Date(startDate + 'T00:00:00')
    if (isNaN(date.getTime())) return null
    date.setDate(date.getDate() + dayIndex)
    const isCN = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'
    const weekdays = isCN
      ? ['日', '一', '二', '三', '四', '五', '六']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const month = date.getMonth() + 1
    const day = date.getDate()
    const wd = weekdays[date.getDay()]
    return isCN ? `${month}/${day} (${wd})` : `${month}/${day} (${wd})`
  } catch {
    return null
  }
}

export function TripItinerary({
  initialDays,
  validated = true,
  destination,
  language,
  startDate,
  onRemovePlace,
  onSaveDays,
  tripId,
}: {
  initialDays: DayPlan[]
  validated?: boolean
  destination?: string
  language?: string
  startDate?: string
  onRemovePlace?: (dayIndex: number, placeIndex: number) => Promise<boolean>
  onSaveDays?: (updatedDays: DayPlan[]) => Promise<void>
  tripId?: string
}) {
  const showYelp = isUSDestination(destination)
  const [days, setDays] = useState(initialDays)
  const [swappedKey, setSwappedKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [removingKey, setRemovingKey] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
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

      let updatedDays: DayPlan[] | null = null

      if (result.removed) {
        updatedDays = days.map((d, di) => {
          if (di !== dayIndex) return d
          return { ...d, places: d.places.filter((_, pi) => pi !== placeIndex) }
        })
      } else if (result.place) {
        updatedDays = days.map((d, di) => {
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
                backupOptions: result.place.backupOptions?.map((b: any) => ({
                  ...b,
                  googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name)}+${encodeURIComponent(destination || '')}`,
                  yelpUrl: `https://www.yelp.com/search?find_desc=${encodeURIComponent(b.name)}&find_loc=${encodeURIComponent(destination || '')}`,
                })),
                googleMapsUrl: result.place.googleMapsUrl,
                googleReviewsUrl: result.place.googleReviewsUrl,
                yelpUrl: result.place.yelpUrl,
              }
            }),
          }
        })
      }

      // Save to Redis and reload via parent callback
      if (updatedDays && onSaveDays) {
        await onSaveDays(updatedDays)
      } else if (updatedDays) {
        setDays(updatedDays)
      }
    } catch (err) {
      console.error('[edit] Failed:', err)
    } finally {
      setEditingKey(null)
    }
  }, [days, destination, language, onSaveDays])

  const isChinese = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'

  const handleRemove = useCallback(async (dayIndex: number, placeIndex: number) => {
    if (!onRemovePlace) return
    const key = `${dayIndex}-${placeIndex}`
    const placeName = days[dayIndex].places[placeIndex].name
    setRemovingKey(key)

    try {
      const success = await onRemovePlace(dayIndex, placeIndex)
      if (success) {
        // Remove place from local state
        setDays(prev => prev.map((d, di) => {
          if (di !== dayIndex) return d
          return { ...d, places: d.places.filter((_, pi) => pi !== placeIndex) }
        }))
        const msg = isChinese ? `已移除 ${placeName}` : `Removed ${placeName}`
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
      }
    } catch (err) {
      console.error('[remove] Failed:', err)
      setToast(isChinese ? '移除失敗' : 'Remove failed')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setRemovingKey(null)
    }
  }, [days, onRemovePlace, isChinese])

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
              Day {day.dayNumber}{startDate ? ` · ${formatDayDate(startDate, i, language) ?? ''}` : ''}
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
            <h2 className="font-bold text-lg">
              Day {day.dayNumber}
              {startDate && formatDayDate(startDate, dayIndex, language) && (
                <span className="font-normal text-sm opacity-70 ml-2">
                  {formatDayDate(startDate, dayIndex, language)}
                </span>
              )}
            </h2>
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
                      onRemove={onRemovePlace ? () => handleRemove(dayIndex, placeIndex) : undefined}
                      editLoading={isEditing}
                      removeLoading={removingKey === key}
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

          {/* Hotel suggestion at end of each day (except last day, only for 2+ day trips) */}
          {days.length >= 2 && dayIndex < days.length - 1 && tripId && destination && (
            <div className="mt-3">
              <HotelSuggestion
                destination={destination}
                dayCity={getDayCity(day.places, destination, day.title)}
                days={days.length}
                language={language}
                tripId={tripId}
                dayNumber={day.dayNumber}
              />
            </div>
          )}
        </section>
      ))}

      {/* Removal confirmation toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </>
  )
}
