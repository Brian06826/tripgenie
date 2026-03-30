'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Trip } from '@/lib/types'
import { TripItinerary } from './TripItinerary'
import { TripMap } from './TripMap'
import { TripEditBar } from './TripEditBar'

function localStorageKey(tripId: string) {
  return `tripgenie_edited_${tripId}`
}

function saveToLocal(trip: Trip) {
  try {
    const payload = { trip, savedAt: Date.now() }
    localStorage.setItem(localStorageKey(trip.id), JSON.stringify(payload))
  } catch {}
}

function loadFromLocal(tripId: string): Trip | null {
  try {
    const raw = localStorage.getItem(localStorageKey(tripId))
    if (!raw) return null
    const { trip } = JSON.parse(raw) as { trip: Trip; savedAt: number }
    if (!trip?.id || !trip?.days) return null
    return trip
  } catch {
    return null
  }
}

interface Props {
  trip: Trip
}

export function TripEditor({ trip }: Props) {
  // On mount: prefer localStorage version over server-rendered prop (beats Vercel cache)
  const [currentTrip, setCurrentTrip] = useState<Trip>(() => {
    if (typeof window === 'undefined') return trip
    const local = loadFromLocal(trip.id)
    if (local) {
      // Use localStorage version — it has the user's latest edits
      // Clear it once we've used it (server will catch up on next deploy/revalidate)
      return local
    }
    return trip
  })
  const [editVersion, setEditVersion] = useState(0)
  const [undoStack, setUndoStack] = useState<Trip[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Whenever currentTrip changes (from edit, undo, remove), persist to localStorage
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    saveToLocal(currentTrip)
  }, [currentTrip])

  const handleEdit = useCallback(async (instruction: string, language: string) => {
    setIsEditing(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/edit-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: currentTrip.id,
          instruction,
          language,
        }),
        signal: controller.signal,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Edit failed')
      }

      if (data.trip) {
        // Push current state to undo stack (max 5)
        setUndoStack(prev => [currentTrip, ...prev].slice(0, 5))
        setCurrentTrip(data.trip as Trip)
        setEditVersion(v => v + 1)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — show brief message
        setError(currentTrip.language === 'en' ? 'Edit cancelled' : '已取消修改')
        setIsEditing(false)
        return
      }
      setError(err instanceof Error ? err.message : 'Edit failed. Please try again.')
    } finally {
      abortRef.current = null
      setIsEditing(false)
    }
  }, [currentTrip])

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
        body: JSON.stringify({
          tripId: currentTrip.id,
          tripData: previousTrip,
        }),
      })

      if (!res.ok) throw new Error('Undo failed')

      setCurrentTrip(previousTrip)
      setUndoStack(prev => prev.slice(1))
      setEditVersion(v => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed')
    } finally {
      setIsEditing(false)
    }
  }, [currentTrip.id, undoStack])

  const handleRemovePlace = useCallback(async (dayIndex: number, placeIndex: number): Promise<boolean> => {
    // Build updated trip with place removed
    const updatedDays = currentTrip.days.map((d, di) => {
      if (di !== dayIndex) return d
      return { ...d, places: d.places.filter((_, pi) => pi !== placeIndex) }
    })
    const updatedTrip: Trip = { ...currentTrip, days: updatedDays }

    try {
      // Push to undo stack before removing
      setUndoStack(prev => [currentTrip, ...prev].slice(0, 5))

      // Persist to Redis via undo mode (direct save)
      const res = await fetch('/api/edit-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: currentTrip.id, tripData: updatedTrip }),
      })
      if (!res.ok) throw new Error('Save failed')

      setCurrentTrip(updatedTrip)
      return true
    } catch (err) {
      console.error('[remove-place] Save failed:', err)
      // Revert undo stack on failure
      setUndoStack(prev => prev.slice(1))
      return false
    }
  }, [currentTrip])

  return (
    <>
      <TripMap key={`map-${editVersion}`} days={currentTrip.days} />
      <TripItinerary
        key={`itin-${editVersion}`}
        initialDays={currentTrip.days}
        validated={currentTrip.validated === true}
        destination={currentTrip.destination}
        language={currentTrip.language}
        onRemovePlace={handleRemovePlace}
      />

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
    </>
  )
}
