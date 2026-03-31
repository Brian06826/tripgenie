'use client'

import { useEffect } from 'react'
import { saveRecentTrip } from '@/lib/recent-trips'

interface Props {
  id: string
  title: string
  destination: string
  days: number
  createdAt: string
}

export function SaveRecentTrip({ id, title, destination, days, createdAt }: Props) {
  useEffect(() => {
    saveRecentTrip({
      id,
      title,
      destination,
      days,
      createdAt,
      url: `/trip/${id}`,
    })
    // Clear pending trip marker — generation completed successfully
    try { sessionStorage.removeItem('tg_pending_trip') } catch {}
  }, [id, title, destination, days, createdAt])

  return null
}
