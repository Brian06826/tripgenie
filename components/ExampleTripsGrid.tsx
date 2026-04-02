'use client'

import { useState } from 'react'
import { ExampleTripLink } from '@/components/ExampleTripLink'

interface Trip {
  title: string
  subtitle: string
  href: string
  flag: string
  gradient: string
  stops: number
  avgRating: number
}

export function ExampleTripsGrid({ trips, isZh }: { trips: Trip[]; isZh: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? trips : trips.slice(0, 4)

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {visible.map(trip => (
          <ExampleTripLink
            key={trip.href}
            href={trip.href}
            title={trip.title}
            subtitle={trip.subtitle}
            flag={trip.flag}
            gradient={trip.gradient}
            stops={trip.stops}
            avgRating={trip.avgRating}
            isZh={isZh}
          />
        ))}
      </div>
      {!expanded && trips.length > 4 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          {isZh ? `顯示更多 (${trips.length - 4})` : `Show more (${trips.length - 4})`}
        </button>
      )}
    </>
  )
}
