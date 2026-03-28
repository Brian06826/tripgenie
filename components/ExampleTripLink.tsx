'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  href: string
  title: string
  subtitle: string
}

export function ExampleTripLink({ href, title, subtitle }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    // Small delay so the skeleton renders before React starts the navigation
    setTimeout(() => router.push(href), 80)
  }

  return (
    <>
      {loading && <TripSkeleton />}
      <a
        href={href}
        onClick={handleClick}
        className="block bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-orange/30 transition-colors"
      >
        <div className="font-semibold text-gray-900 text-sm">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>
      </a>
    </>
  )
}

function TripSkeleton() {
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto animate-in fade-in duration-200">
      {/* Header skeleton */}
      <div className="h-40 bg-gradient-to-b from-gray-300 to-gray-200 animate-pulse px-4 pt-8 pb-6">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="h-3 w-16 bg-white/40 rounded" />
          <div className="h-6 w-56 bg-white/40 rounded" />
          <div className="h-3 w-32 bg-white/30 rounded" />
          <div className="mt-4 h-10 bg-white/20 rounded-xl" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-xl mx-auto px-4 py-4 space-y-3">
        <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 animate-pulse">
            <div className="h-3 w-20 bg-orange/30 rounded" />
            <div className="h-4 w-40 bg-gray-200 rounded" />
            <div className="h-3 w-28 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded" />
            <div className="flex gap-2">
              <div className="flex-1 h-10 bg-blue-50 rounded-lg" />
              <div className="flex-1 h-10 bg-blue-50 rounded-lg" />
              <div className="flex-1 h-10 bg-red-50 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
