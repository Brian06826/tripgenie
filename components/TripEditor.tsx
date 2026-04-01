'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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

    // Save current state for undo before AI edit
    setUndoStack(prev => [currentTrip, ...prev].slice(0, 10))
    setIsEditing(true)
    setError(null)

    const dayLabel = `Day ${dayIndex + 1}`
    const instruction = `Remove "${place.name}" from ${dayLabel} and adjust the remaining schedule times to fill the gap naturally`

    try {
      const res = await fetch('/api/edit-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, instruction, language: currentTrip.language }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Remove failed')

      if (data.trip) {
        const isCN = currentTrip.language !== 'en'
        const msg = isCN ? `已移除 ${place.name}` : `Removed ${place.name}`
        try {
          sessionStorage.setItem('lulgo_undo', JSON.stringify({ message: msg, tripData: currentTrip }))
        } catch {}
        window.location.reload()
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
      setIsEditing(false)
      // Remove the undo entry we just added since the edit failed
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
        startDate={currentTrip.startDate}
        tripId={tripId}
        onRemovePlace={handleRemovePlace}
        onSaveDays={handleSaveDays}
      />

      {/* Hotel reminder tip for multi-day trips */}
      {currentTrip.days.length >= 2 && (
        <p className="text-center text-xs text-gray-400 mt-2 mb-1">
          {currentTrip.language === 'zh-TW' || currentTrip.language === 'zh-HK' || currentTrip.language === 'zh-CN'
            ? '💡 提示：你可以喺每日行程最尾加入酒店'
            : '💡 Tip: You can add a hotel at the end of each day\'s itinerary'}
        </p>
      )}

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
              setUndoToast(null)
              setIsEditing(true)
              try {
                const res = await fetch('/api/edit-trip', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tripId, tripData: undoToast.tripData }),
                })
                if (!res.ok) throw new Error('Undo failed')
                window.location.reload()
              } catch {
                setError(currentTrip.language === 'en' ? 'Undo failed' : '撤銷失敗')
                setIsEditing(false)
              }
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
