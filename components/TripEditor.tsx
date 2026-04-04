'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Trip, DayPlan, Place } from '@/lib/types'
import { TripItinerary } from './TripItinerary'
import { TripMap } from './TripMap'
import { TripEditBar } from './TripEditBar'

// --- Time utilities for instant delete ---
function parseTimeToMinutes(timeStr: string): number | null {
  // Parse "2:00 PM", "14:00", "9:30 AM" etc.
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

function parseDurationMinutes(dur: string): number {
  // "1-2 hours" → 90, "30 mins" → 30, "2 hours" → 120, "1.5 hours" → 90
  const rangeMatch = dur.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*hour/i)
  if (rangeMatch) return Math.round((parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2 * 60)
  const hourMatch = dur.match(/(\d+\.?\d*)\s*hour/i)
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60)
  const minMatch = dur.match(/(\d+)\s*min/i)
  if (minMatch) return parseInt(minMatch[1])
  return 60 // default 1 hour
}

function adjustTimesAfterRemoval(places: Place[], removedIndex: number): Place[] {
  if (places.length === 0) return places

  // Build result sequentially so each place uses the ADJUSTED previous place's time
  const result = [...places]
  const startIdx = Math.max(removedIndex, 1) // adjust from removedIndex, but at least from index 1

  for (let i = startIdx; i < result.length; i++) {
    const p = result[i]
    if (!p.arrivalTime) continue

    const prevPlace = result[i - 1]
    if (!prevPlace?.arrivalTime) continue

    const prevStart = parseTimeToMinutes(prevPlace.arrivalTime)
    if (prevStart === null) continue

    const prevDur = prevPlace.duration ? parseDurationMinutes(prevPlace.duration) : 60
    const buffer = 15 // travel buffer
    let newStart = prevStart + prevDur + buffer

    const currentMins = parseTimeToMinutes(p.arrivalTime)
    if (currentMins === null) continue

    // Only move earlier (close the gap), never push later
    if (newStart >= currentMins) continue

    // Meal-time guards: don't break meal windows
    // Apply guard first, then check if the guarded time is still earlier
    const isLunchMeal = p.type === 'restaurant' && currentMins >= 660 && currentMins <= 840
    const isDinnerMeal = p.type === 'restaurant' && currentMins >= 1020 && currentMins <= 1260

    if (isLunchMeal && newStart < 660) newStart = 660     // Lunch no earlier than 11:00 AM
    if (isDinnerMeal && newStart < 1050) newStart = 1050  // Dinner no earlier than 5:30 PM

    // After meal guard, still only move earlier
    if (newStart >= currentMins) {
      // Meal guard pushed past current time — cap at max allowed gap (90 min after prev ends)
      const maxGap = 90
      const prevEnd = prevStart + prevDur
      const cappedStart = Math.min(currentMins, prevEnd + maxGap)
      if (cappedStart < currentMins) {
        // Apply meal floor again on the capped value
        let finalStart = cappedStart
        if (isLunchMeal && finalStart < 660) finalStart = 660
        if (isDinnerMeal && finalStart < 1050) finalStart = 1050
        if (finalStart < currentMins) {
          const is12h = p.arrivalTime.includes('AM') || p.arrivalTime.includes('PM')
          result[i] = { ...p, arrivalTime: minutesToTimeStr(finalStart, is12h) }
        }
      }
      continue
    }

    const is12h = p.arrivalTime.includes('AM') || p.arrivalTime.includes('PM')
    result[i] = { ...p, arrivalTime: minutesToTimeStr(newStart, is12h) }
  }

  return result
}

interface Props {
  tripId: string
  trip: Trip
}

export function TripEditor({ tripId, trip }: Props) {
  const [currentTrip, setCurrentTrip] = useState<Trip>(trip)
  const [editVersion, setEditVersion] = useState(0)
  const [undoStack, setUndoStack] = useState<Trip[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [undoToast, setUndoToast] = useState<{ message: string; tripData: Trip } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check sessionStorage for pending undo on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('lulgo_undo')
      if (stored) {
        sessionStorage.removeItem('lulgo_undo')
        const { message, tripData } = JSON.parse(stored)
        setUndoToast({ message, tripData })
        undoTimerRef.current = setTimeout(() => setUndoToast(null), 8000)
      }
    } catch {}
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }
  }, [])

  const handleEdit = useCallback(async (instruction: string, language: string) => {
    setIsEditing(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/edit-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, instruction, language }),
        signal: controller.signal,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Edit failed')
      }

      if (data.trip) {
        // Edit saved to Redis by the API — reload to get fresh server render
        window.location.reload()
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(currentTrip.language === 'en' ? 'Edit cancelled' : '已取消修改')
        setIsEditing(false)
        return
      }
      setError(err instanceof Error ? err.message : 'Edit failed. Please try again.')
      setIsEditing(false)
    } finally {
      abortRef.current = null
    }
  }, [currentTrip, tripId])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return

    const previousTrip = undoStack[0]
    setIsEditing(true)
    setError(null)

    try {
      const res = await fetch('/api/edit-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, tripData: previousTrip }),
      })

      if (!res.ok) throw new Error('Undo failed')

      // Saved to Redis — reload to get fresh server render
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed')
      setIsEditing(false)
    }
  }, [tripId, undoStack])

  const handleSaveDays = useCallback(async (updatedDays: DayPlan[]) => {
    const updatedTrip: Trip = { ...currentTrip, days: updatedDays }

    const res = await fetch('/api/edit-trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, tripData: updatedTrip }),
    })
    if (!res.ok) throw new Error('Save failed')

    window.location.reload()
  }, [currentTrip, tripId])

  const handleRemovePlace = useCallback(async (dayIndex: number, placeIndex: number): Promise<boolean> => {
    const place = currentTrip.days[dayIndex]?.places[placeIndex]
    if (!place) return false

    const isCN = currentTrip.language !== 'en'

    // Save current trip for undo
    const previousTrip = currentTrip

    // Instant removal + time adjustment on frontend
    const updatedDays = currentTrip.days.map((d, di) => {
      if (di !== dayIndex) return d
      const filtered = d.places.filter((_, pi) => pi !== placeIndex)
      const adjusted = adjustTimesAfterRemoval(filtered, placeIndex)
      return { ...d, places: adjusted }
    })
    const updatedTrip: Trip = { ...currentTrip, days: updatedDays }

    // Update UI instantly
    setCurrentTrip(updatedTrip)
    setEditVersion(v => v + 1)

    // Show undo toast
    const msg = isCN ? `已移除 ${place.name}` : `Removed ${place.name}`
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoToast({ message: msg, tripData: previousTrip })
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 8000)

    // Save to Redis in background (fire-and-forget)
    fetch('/api/edit-trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, tripData: updatedTrip }),
    }).catch(() => {
      setError(isCN ? '儲存失敗' : 'Save failed')
    })

    return true
  }, [currentTrip, tripId])

  // Time cascade: save with undo support
  const handleTimeCascade = useCallback((updatedDays: DayPlan[], adjustedCount: number) => {
    const previousTrip = currentTrip
    const isCN = currentTrip.language !== 'en'
    const updatedTrip: Trip = { ...currentTrip, days: updatedDays }

    // Update parent state (TripItinerary already updated its own local state)
    setCurrentTrip(updatedTrip)

    // Show undo toast only when cascade actually adjusted other stops
    if (adjustedCount > 0) {
      const msg = isCN
        ? `已調整 ${adjustedCount} 個景點時間`
        : `Times adjusted for ${adjustedCount} stop${adjustedCount > 1 ? 's' : ''}`
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      setUndoToast({ message: msg, tripData: previousTrip })
      undoTimerRef.current = setTimeout(() => setUndoToast(null), 8000)
    }

    // Fire-and-forget save to Redis
    fetch('/api/edit-trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, tripData: updatedTrip }),
    }).catch(() => {
      setError(isCN ? '儲存失敗' : 'Save failed')
    })
  }, [currentTrip, tripId])

  // Save to Redis without page reload (for lightweight edits like time changes)
  const handleSaveQuiet = useCallback(async (updatedDays: DayPlan[]) => {
    const updatedTrip: Trip = { ...currentTrip, days: updatedDays }
    setCurrentTrip(updatedTrip)

    fetch('/api/edit-trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, tripData: updatedTrip }),
    }).catch(() => {
      setError(currentTrip.language === 'en' ? 'Save failed' : '儲存失敗')
    })
  }, [currentTrip, tripId])

  return (
    <>
      <TripMap key={`map-${editVersion}`} days={currentTrip.days} language={currentTrip.language} />
      <TripItinerary
        key={`itin-${editVersion}`}
        initialDays={currentTrip.days}
        validated={currentTrip.validated === true}
        destination={currentTrip.destination}
        language={currentTrip.language}
        startDate={currentTrip.startDate}
        tripId={tripId}
        onRemovePlace={handleRemovePlace}
        onSaveDays={handleSaveDays}
        onSaveQuiet={handleSaveQuiet}
        onTimeCascade={handleTimeCascade}
      />

      {/* Activity hint */}
      <p className="text-center text-xs text-gray-400 mt-2 mb-1">
        {currentTrip.language === 'zh-TW' || currentTrip.language === 'zh-HK' || currentTrip.language === 'zh-CN'
          ? "💡 想加活動？用下面嘅編輯框話畀 AI！例如：'加個酒吧' 或 '加個夜市'"
          : "💡 Want to add activities? Use the edit box below! e.g. 'add a bar' or 'add night market'"}
      </p>

      {/* Spacer so fixed edit bar doesn't cover content */}
      <div className="h-20" />

      <TripEditBar
        onSubmit={handleEdit}
        onUndo={handleUndo}
        onCancel={handleCancel}
        canUndo={undoStack.length > 0}
        isLoading={isEditing}
        error={error}
        language={currentTrip.language}
      />

      {/* Undo toast after delete */}
      {undoToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <span>{undoToast.message}</span>
          <button
            onClick={async () => {
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
              const restored = undoToast.tripData
              setUndoToast(null)
              setCurrentTrip(restored)
              setEditVersion(v => v + 1)
              // Save restored state to Redis in background
              fetch('/api/edit-trip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tripId, tripData: restored }),
              }).catch(() => {
                setError(currentTrip.language === 'en' ? 'Undo failed' : '撤銷失敗')
              })
            }}
            className="font-semibold text-orange hover:text-orange/80 transition-colors whitespace-nowrap"
          >
            {currentTrip.language === 'en' ? 'Undo' : '撤銷'}
          </button>
          <button
            onClick={() => {
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
              setUndoToast(null)
            }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
