'use client'

import { useEffect } from 'react'
import { saveRecentTrip } from '@/lib/recent-trips'
import { cacheTrip } from '@/lib/native/offline-cache'
import type { Trip } from '@/lib/types'

interface Props {
  id: string
  title: string
  destination: string
  days: number
  createdAt: string
  trip?: Trip
}

export function SaveRecentTrip({ id, title, destination, days, createdAt, trip }: Props) {
  useEffect(() => {
    saveRecentTrip({
      id,
      title,
      destination,
      days,
      createdAt,
      url: `/trip/${id}`,
    })
    // Persist the full trip to Capacitor Preferences so it's available offline.
    if (trip) {
      cacheTrip(trip).catch(() => {})
    }
    // Clear pending trip marker — generation completed successfully
    try { sessionStorage.removeItem('tg_pending_trip') } catch {}
  }, [id, title, destination, days, createdAt, trip])

  return null
}
