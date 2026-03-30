'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Trip } from '@/lib/types'
import { TripItinerary } from './TripItinerary'
import { TripMap } from './TripMap'
import { TripEditBar } from './TripEditBar'

function lsKey(id: string) {
  return `tripgenie_edited_${id}`
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
  const abortRef = useRef<AbortController | null>(null)

  // On mount: check localStorage and override server data if edited version exists
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey(tripId))
      if (!raw) return
      const parsed = JSON.parse(raw) as Trip
      if (parsed?.days?.length > 0) {
        setCurrentTrip(parsed)
        setEditVersion(v => v + 1)
      }
    } catch (e) {
      console.error('[TripEditor] Failed to load from localStorage:', e)
    }
  }, [tripId])

  // Save to localStorage helper — uses the explicit tripId prop, never trip.id
  function persistLocal(t: Trip) {
    try {
      localStorage.setItem(lsKey(tripId), JSON.stringify(t))
    } catch (e) {
      console.error('[TripEditor] Failed to save to localStorage:', e)
    }
  }

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
          tripId,
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
        persistLocal(updated)
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
        body: JSON.stringify({
          tripId,
          tripData: previousTrip,
        }),
      })

      if (!res.ok) throw new Error('Undo failed')

      setCurrentTrip(previousTrip)
      setUndoStack(prev => prev.slice(1))
      setEditVersion(v => v + 1)
      persistLocal(previousTrip)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed')
    } finally {
      setIsEditing(false)
    }
  }, [tripId, undoStack])

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
        body: JSON.stringify({ tripId, tripData: updatedTrip }),
      })
      if (!res.ok) throw new Error('Save failed')

      setCurrentTrip(updatedTrip)
      persistLocal(updatedTrip)
      return true
    } catch (err) {
      console.error('[remove-place] Save failed:', err)
      setUndoStack(prev => prev.slice(1))
      return false
    }
  }, [currentTrip, tripId])

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
