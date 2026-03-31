'use client'

import { useState } from 'react'

const ASIA_SIGNALS = [
  'japan', 'tokyo', 'osaka', 'kyoto', 'fukuoka', 'sapporo', 'okinawa', 'nagoya', 'hiroshima', 'nara',
  'korea', 'seoul', 'busan', 'jeju',
  'taiwan', 'taipei', 'taichung', 'tainan', 'kaohsiung',
  'thailand', 'bangkok', 'phuket', 'chiang mai', 'pattaya',
  'vietnam', 'hanoi', 'ho chi minh', 'da nang',
  'singapore',
  'hong kong',
  'china', 'shanghai', 'beijing', 'shenzhen', 'guangzhou', 'chengdu', 'hangzhou',
  'malaysia', 'kuala lumpur',
  'indonesia', 'bali', 'jakarta',
  'philippines', 'manila', 'cebu',
  '日本', '東京', '大阪', '京都', '韓國', '首爾', '台灣', '台北', '泰國', '曼谷',
  '越南', '河內', '新加坡', '香港', '中國', '上海', '北京', '馬來西亞', '印尼', '峇里',
  '菲律賓', '沖繩', '福岡', '札幌',
]

function isAsianDestination(destination: string): boolean {
  const dest = destination.toLowerCase()
  return ASIA_SIGNALS.some(s => dest.includes(s))
}

function formatDateForGoogle(dateStr: string): string {
  // Try to parse dates like "March 4, 2026" or "2026-03-04"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function buildGoogleHotelsUrl(destination: string, checkin?: string, checkout?: string): string {
  const base = `https://www.google.com/travel/hotels/${encodeURIComponent(destination)}`
  if (checkin && checkout) {
    const ci = formatDateForGoogle(checkin)
    const co = formatDateForGoogle(checkout)
    if (ci && co) return `${base}?q=${encodeURIComponent(destination)}&dates=${ci}_${co}`
  }
  return base
}

function buildBookingUrl(destination: string, checkin?: string, checkout?: string): string {
  let url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`
  if (checkin && checkout) {
    const ci = formatDateForGoogle(checkin)
    const co = formatDateForGoogle(checkout)
    if (ci && co) url += `&checkin=${ci}&checkout=${co}`
  }
  return url
}

function buildAgodaUrl(destination: string, checkin?: string, checkout?: string): string {
  let url = `https://www.agoda.com/search?city=${encodeURIComponent(destination)}`
  if (checkin && checkout) {
    const ci = formatDateForGoogle(checkin)
    const co = formatDateForGoogle(checkout)
    if (ci && co) url += `&checkIn=${ci}&checkOut=${co}`
  }
  return url
}

interface Props {
  destination: string
  days: number
  language?: string
  tripId: string
}

export function HotelSuggestion({ destination, days, language, tripId }: Props) {
  const [aiLoading, setAiLoading] = useState(false)

  if (days < 2) return null

  const isChinese = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'
  const showAgoda = isAsianDestination(destination)

  const googleUrl = buildGoogleHotelsUrl(destination)
  const bookingUrl = buildBookingUrl(destination)
  const agodaUrl = buildAgodaUrl(destination)

  async function handleAiRecommend() {
    setAiLoading(true)
    try {
      const instruction = `Add a highly-rated hotel recommendation near the main itinerary area. Add it as the LAST place of Day 1 with type "hotel", arrivalTime around check-in time (3:00 PM). Include Google rating, price range, and a brief description. The hotel should be well-located for the planned activities.`
      const res = await fetch('/api/edit-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, instruction, language: language ?? 'en' }),
      })
      if (!res.ok) throw new Error('Failed')
      window.location.reload()
    } catch {
      setAiLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">
        🏨 {isChinese ? '需要酒店？' : 'Need a hotel?'}
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          🔍 Google Hotels
        </a>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          🅱️ Booking.com
        </a>
        {showAgoda && (
          <a
            href={agodaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            🏠 Agoda
          </a>
        )}
        <button
          onClick={handleAiRecommend}
          disabled={aiLoading}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-orange/10 border border-orange/30 text-orange rounded-lg px-3 py-2 hover:bg-orange/20 transition-colors disabled:opacity-50"
        >
          {aiLoading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-orange/30 border-t-orange rounded-full animate-spin" />
              {isChinese ? '推薦中...' : 'Finding...'}
            </>
          ) : (
            <>✨ {isChinese ? 'AI 推薦' : 'AI Recommend'}</>
          )}
        </button>
      </div>
    </div>
  )
}
