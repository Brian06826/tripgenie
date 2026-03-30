'use client'

import { useState, useCallback, useRef } from 'react'
import type { Trip } from '@/lib/types'
import { TripItinerary } from './TripItinerary'
import { TripMap } from './TripMap'
import { TripEditBar } from './TripEditBar'

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

  return (
    <>
      {/* DEBUG BANNER — remove after confirming */}
      <div className="bg-yellow-300 text-black p-3 rounded-lg mb-4 text-sm font-mono">
        <p className="font-bold">TripEditor loaded ✅</p>
        <p>Trip ID: {currentTrip.id}</p>
        <p>Language: {currentTrip.language}</p>
        <p>Undo stack: {undoStack.length} | isEditing: {String(isEditing)}</p>
        {error && <p className="text-red-700 font-bold">Error: {error}</p>}
      </div>
      <TripMap key={`map-${editVersion}`} days={currentTrip.days} />
      <TripItinerary
        key={`itin-${editVersion}`}
        initialDays={currentTrip.days}
        validated={currentTrip.validated === true}
        destination={currentTrip.destination}
        language={currentTrip.language}
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
