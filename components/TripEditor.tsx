'use client'

import { useState, useCallback, useRef } from 'react'
import type { Trip, DayPlan } from '@/lib/types'
import { TripItinerary } from './TripItinerary'
import { TripMap } from './TripMap'
import { TripEditBar } from './TripEditBar'

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
    const updatedDays = currentTrip.days.map((d, di) => {
      if (di !== dayIndex) return d
      return { ...d, places: d.places.filter((_, pi) => pi !== placeIndex) }
    })
    const updatedTrip: Trip = { ...currentTrip, days: updatedDays }

    try {
      const res = await fetch('/api/edit-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, tripData: updatedTrip }),
      })
      if (!res.ok) throw new Error('Save failed')

      // Saved to Redis — reload to get fresh server render
      window.location.reload()
      return true
    } catch (err) {
      console.error('[remove-place] Save failed:', err)
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
        onSaveDays={handleSaveDays}
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
