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
  dayNumber: number
}

export function HotelSuggestion({ destination, days, language, tripId, dayNumber }: Props) {
  const [aiLoading, setAiLoading] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [hotelName, setHotelName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (days < 2) return null

  const isChinese = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'
  const showAgoda = isAsianDestination(destination)

  const googleUrl = buildGoogleHotelsUrl(destination)
  const bookingUrl = buildBookingUrl(destination)
  const agodaUrl = buildAgodaUrl(destination)

  async function callEditApi(instruction: string) {
    const res = await fetch('/api/edit-trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, instruction, language: language ?? 'en' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed')
    }
    window.location.reload()
  }

  async function handleAiRecommend() {
    setAiLoading(true)
    setError(null)
    try {
      const instruction = `Add a highly-rated hotel recommendation near the main itinerary area in ${destination}. Add it as the LAST place of Day ${dayNumber} with type "hotel", arrivalTime "3:00 PM", duration "Check-in". Include Google rating, price range, and a brief description. The hotel should be well-located for the planned activities.`
      await callEditApi(instruction)
    } catch {
      setError(isChinese ? '推薦失敗，請重試' : 'Failed, please try again')
      setAiLoading(false)
    }
  }

  async function handleAddHotel() {
    const name = hotelName.trim()
    if (!name) return
    setAddLoading(true)
    setError(null)
    try {
      const instruction = isChinese
        ? `在 Day ${dayNumber} 的最後加入「${name}」作為酒店入住，類型為 "hotel"，到達時間為 "3:00 PM"，時長為 "Check-in"。請加入該酒店的 Google 評分、價格範圍和簡短描述。`
        : `Add "${name}" as the LAST place of Day ${dayNumber} with type "hotel", arrivalTime "3:00 PM", duration "Check-in". Include the hotel's Google rating, price range, and a brief description.`
      await callEditApi(instruction)
    } catch {
      setError(isChinese ? '加入失敗，請重試' : 'Failed to add, please try again')
      setAddLoading(false)
    }
  }

  const isLoading = aiLoading || addLoading

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">
        🏨 {isChinese ? `Day ${dayNumber} 需要酒店？` : `Need a hotel for Day ${dayNumber}?`}
      </p>

      {/* Booking links + AI recommend */}
      <div className="flex flex-wrap gap-2 mb-3">
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
          disabled={isLoading}
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

      {/* Manual hotel name input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={hotelName}
          onChange={(e) => setHotelName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddHotel() }}
          placeholder={isChinese ? '輸入酒店名稱...' : 'Enter your hotel name...'}
          disabled={isLoading}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={handleAddHotel}
          disabled={isLoading || !hotelName.trim()}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-orange text-white rounded-lg px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {addLoading ? (
            <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>➕ {isChinese ? '加入行程' : 'Add to Trip'}</>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}
