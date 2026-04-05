'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

interface Props {
  href: string
  title: string
  subtitle: string
  flag?: string
  gradient?: string
  imageUrl?: string
  stops?: number
  avgRating?: number
}

export function ExampleTripLink({ href, title, subtitle, flag, gradient, imageUrl, stops, avgRating }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { locale } = useUILocale()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => router.push(href), 80)
  }

  return (
    <>
      {loading && <TripSkeleton />}
      <a
        href={href}
        onClick={handleClick}
        className="relative flex items-center gap-2.5 rounded-xl p-3 h-[88px] text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] overflow-hidden"
      >
        {/* Background: image or gradient */}
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-black/20" />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient || 'from-gray-500 to-gray-600'}`} />
        )}

        {/* Content */}
        <div className="relative flex items-center gap-2.5 w-full">
          {flag && <span className="text-xl shrink-0">{flag}</span>}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm leading-tight truncate">{title}</div>
            <div className="text-xs text-white/70 mt-0.5 leading-snug truncate">{subtitle}</div>
            {(stops || avgRating) && (
              <div className="flex items-center gap-2 mt-1">
                {stops && (
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                    {t(locale, 'example.stops', { n: stops })}
                  </span>
                )}
                {avgRating && (
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                    {avgRating.toFixed(1)} avg
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
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
