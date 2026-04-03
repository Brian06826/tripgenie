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

// --- Time utilities for cascade ---
function parseTimeToMinutes(timeStr: string): number | null {
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12) {
    let h = parseInt(match12[1])
    const m = parseInt(match12[2])
    const period = match12[3].toUpperCase()
    if (period === 'PM' && h !== 12) h += 12
    if (period === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) return parseInt(match24[1]) * 60 + parseInt(match24[2])
  return null
}

function minutesToTimeStr(mins: number, use12h = true): string {
  const h24 = Math.floor(mins / 60) % 24
  const m = mins % 60
  if (!use12h) return `${h24}:${m.toString().padStart(2, '0')}`
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}

interface CascadeResult {
  updatedPlaces: DayPlan['places']
  adjustedCount: number
}

function cascadeTimes(places: DayPlan['places'], changedIndex: number, newTime: string): CascadeResult {
  const oldTime = places[changedIndex]?.arrivalTime
  const oldMins = oldTime ? parseTimeToMinutes(oldTime) : null
  const newMins = parseTimeToMinutes(newTime)

  // Can't calculate delta — just update the one place
  if (oldMins === null || newMins === null || oldMins === newMins) {
    return {
      updatedPlaces: places.map((p, i) => i === changedIndex ? { ...p, arrivalTime: newTime } : p),
      adjustedCount: 0,
    }
  }

  const delta = newMins - oldMins
  let adjustedCount = 0

  const updatedPlaces = places.map((p, i) => {
    if (i === changedIndex) return { ...p, arrivalTime: newTime }
    if (i <= changedIndex || !p.arrivalTime) return p

    const currentMins = parseTimeToMinutes(p.arrivalTime)
    if (currentMins === null) return p

    const adjusted = currentMins + delta

    // Meal-time guards
    const isLunchMeal = p.type === 'restaurant' && currentMins >= 660 && currentMins <= 840
    const isDinnerMeal = p.type === 'restaurant' && currentMins >= 1020 && currentMins <= 1260

    if (isLunchMeal && adjusted < 660) return p   // Lunch can't be before 11:00 AM
    if (isDinnerMeal && adjusted < 1050) return p  // Dinner can't be before 5:30 PM
    if (adjusted > 1410) return p                  // Nothing past 11:30 PM
    if (adjusted < 0) return p                     // Nothing before midnight

    adjustedCount++
    const is12h = p.arrivalTime.includes('AM') || p.arrivalTime.includes('PM')
    return { ...p, arrivalTime: minutesToTimeStr(adjusted, is12h) }
  })

  return { updatedPlaces, adjustedCount }
}

export function TripItinerary({
  initialDays,
  validated = true,
  destination,
  language,
  startDate,
  onRemovePlace,
  onSaveDays,
  onSaveQuiet,
  onTimeCascade,
  tripId,
}: {
  initialDays: DayPlan[]
  validated?: boolean
  destination?: string
  language?: string
  startDate?: string
  onRemovePlace?: (dayIndex: number, placeIndex: number) => Promise<boolean>
  onSaveDays?: (updatedDays: DayPlan[]) => Promise<void>
  onSaveQuiet?: (updatedDays: DayPlan[]) => Promise<void>
  onTimeCascade?: (updatedDays: DayPlan[], adjustedCount: number) => void
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

  const handleTimeChange = useCallback(async (dayIndex: number, placeIndex: number, newTime: string) => {
    const isCN = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'

    // Apply cascade: adjust subsequent places by delta with meal-time guards
    setDays(prev => {
      const day = prev[dayIndex]
      if (!day) return prev

      const { updatedPlaces, adjustedCount } = cascadeTimes(day.places, placeIndex, newTime)
      const updatedDays = prev.map((d, di) => di === dayIndex ? { ...d, places: updatedPlaces } : d)

      // Notify parent for undo support + Redis save
      if (onTimeCascade && adjustedCount > 0) {
        onTimeCascade(updatedDays, adjustedCount)
      } else if (onTimeCascade) {
        // Single change, still save to Redis via parent
        onTimeCascade(updatedDays, 0)
      } else if (tripId) {
        // Fallback: save via dedicated endpoint
        const dayNumber = day.dayNumber
        fetch('/api/update-place-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId, dayNumber, placeIndex, newTime }),
        }).catch(() => {
          setToast(isCN ? '儲存失敗' : 'Save failed')
          setTimeout(() => setToast(null), 3000)
        })
      }

      return updatedDays
    })
  }, [tripId, language, onTimeCascade])

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
                      onTimeChange={tripId ? (newTime) => handleTimeChange(dayIndex, placeIndex, newTime) : undefined}
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
