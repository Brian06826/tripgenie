'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Trip } from '@/lib/types'
import { TripItinerary } from './TripItinerary'
import { TripMap } from './TripMap'
import { TripEditBar } from './TripEditBar'

function lsKey(tripId: string) {
  return `tripgenie_edited_${tripId}`
}

function saveToLocal(trip: Trip) {
  try {
    localStorage.setItem(lsKey(trip.id), JSON.stringify(trip))
  } catch {}
}

function loadFromLocal(tripId: string): Trip | null {
  try {
    const raw = localStorage.getItem(lsKey(tripId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Handle both old format {trip, savedAt} and new format (plain Trip)
    const trip = parsed?.days ? parsed : parsed?.trip
    if (!trip?.id || !trip?.days) return null
    return trip as Trip
  } catch {
    return null
  }
}

interface Props {
  trip: Trip
}

export function TripEditor({ trip }: Props) {
  const [currentTrip, setCurrentTrip] = useState<Trip>(trip)
  const [editVersion, setEditVersion] = useState(0)
  const [undoStack, setUndoStack] = useState<Trip[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // On mount: check localStorage and override server data if edited version exists
  useEffect(() => {
    const local = loadFromLocal(trip.id)
    if (local) {
      setCurrentTrip(local)
      setEditVersion(v => v + 1)
    }
  }, [trip.id])

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
        const updated = data.trip as Trip
        setUndoStack(prev => [currentTrip, ...prev].slice(0, 5))
        setCurrentTrip(updated)
        setEditVersion(v => v + 1)
        saveToLocal(updated)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
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
      saveToLocal(previousTrip)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed')
    } finally {
      setIsEditing(false)
    }
  }, [currentTrip.id, undoStack])

  const handleRemovePlace = useCallback(async (dayIndex: number, placeIndex: number): Promise<boolean> => {
    const updatedDays = currentTrip.days.map((d, di) => {
      if (di !== dayIndex) return d
      return { ...d, places: d.places.filter((_, pi) => pi !== placeIndex) }
    })
    const updatedTrip: Trip = { ...currentTrip, days: updatedDays }

    try {
      setUndoStack(prev => [currentTrip, ...prev].slice(0, 5))

      const res = await fetch('/api/edit-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: currentTrip.id, tripData: updatedTrip }),
      })
      if (!res.ok) throw new Error('Save failed')

      setCurrentTrip(updatedTrip)
      saveToLocal(updatedTrip)
      return true
    } catch (err) {
      console.error('[remove-place] Save failed:', err)
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
