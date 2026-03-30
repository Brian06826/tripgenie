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
  const [debugInfo, setDebugInfo] = useState('loading...')

  // On mount: check localStorage and override server data if edited version exists
  useEffect(() => {
    const key = lsKey(tripId)
    try {
      const raw = localStorage.getItem(key)
      console.error('[TripEditor] LOAD: tripId=' + tripId + ' key=' + key + ' found=' + (raw ? 'YES (' + raw.length + ' bytes)' : 'NO'))
      if (!raw) {
        setDebugInfo(`tripId: ${tripId} | key: ${key} | hasLocalData: NO | using: server data`)
        return
      }
      const parsed = JSON.parse(raw) as Trip
      if (parsed?.days?.length > 0) {
        setCurrentTrip(parsed)
        setEditVersion(v => v + 1)
        setDebugInfo(`tripId: ${tripId} | key: ${key} | hasLocalData: YES | using: localStorage data | title: ${parsed.title}`)
        console.error('[TripEditor] LOAD SUCCESS: overriding server data with localStorage, title=' + parsed.title)
      } else {
        setDebugInfo(`tripId: ${tripId} | key: ${key} | hasLocalData: YES but invalid (no days) | using: server data`)
        console.error('[TripEditor] LOAD FAILED: parsed data has no days')
      }
    } catch (e) {
      console.error('[TripEditor] LOAD ERROR:', e)
      setDebugInfo(`tripId: ${tripId} | key: ${key} | ERROR: ${e}`)
    }
  }, [tripId])

  // Save to localStorage helper — uses the explicit tripId prop
  function persistLocal(t: Trip) {
    const key = lsKey(tripId)
    try {
      const json = JSON.stringify(t)
      localStorage.setItem(key, json)
      console.error('[TripEditor] PERSIST: key=' + key + ' size=' + json.length + ' title=' + t.title + ' days=' + t.days.length)
      setDebugInfo(`tripId: ${tripId} | key: ${key} | JUST SAVED (${json.length} bytes) | title: ${t.title}`)
    } catch (e) {
      console.error('[TripEditor] PERSIST ERROR:', e)
      setDebugInfo(`tripId: ${tripId} | key: ${key} | SAVE FAILED: ${e}`)
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
      {/* TEMPORARY DEBUG BANNER — remove after confirming localStorage works */}
      <div style={{background:'red',color:'white',padding:'10px',position:'fixed',top:0,left:0,right:0,zIndex:9999,fontSize:'11px',fontFamily:'monospace'}}>
        {debugInfo} | currentTrip.title: {currentTrip.title}
      </div>
      <div style={{height:'40px'}} />

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
