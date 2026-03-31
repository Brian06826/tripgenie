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

/** Extract city name from a place's address (e.g. "123 Main St, Beijing, China" → "Beijing") */
function extractCityFromAddress(address: string): string | null {
  const parts = address.split(',').map(s => s.trim())
  if (parts.length >= 3) {
    const candidate = parts[parts.length - 2].replace(/\d{4,}/g, '').trim()
    if (candidate.length >= 2) return candidate
  }
  if (parts.length === 2) {
    return parts[0]
  }
  return null
}

// Known city names (CJK + English) to extract from day titles like "探索北京故宮"
const CITY_NAMES = [
  // China
  '北京', '上海', '廣州', '深圳', '成都', '杭州', '西安', '重慶', '南京', '蘇州', '武漢', '長沙', '廈門', '昆明', '大理', '麗江', '桂林', '三亞', '哈爾濱', '青島',
  'Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', "Xi'an", 'Xian', 'Chongqing', 'Nanjing', 'Suzhou', 'Wuhan', 'Changsha', 'Xiamen', 'Kunming', 'Dali', 'Lijiang', 'Guilin', 'Sanya', 'Harbin', 'Qingdao',
  // Japan
  '東京', '大阪', '京都', '福岡', '札幌', '沖繩', '名古屋', '廣島', '奈良', '神戶', '橫濱',
  'Tokyo', 'Osaka', 'Kyoto', 'Fukuoka', 'Sapporo', 'Okinawa', 'Nagoya', 'Hiroshima', 'Nara', 'Kobe', 'Yokohama',
  // Korea
  '首爾', '釜山', '濟州',
  'Seoul', 'Busan', 'Jeju',
  // Taiwan
  '台北', '台中', '台南', '高雄', '花蓮',
  'Taipei', 'Taichung', 'Tainan', 'Kaohsiung', 'Hualien',
  // Southeast Asia
  '曼谷', '清邁', '普吉', '河內', '胡志明', '峴港', '新加坡', '吉隆坡', '峇里', '雅加達', '馬尼拉', '宿霧',
  'Bangkok', 'Chiang Mai', 'Phuket', 'Hanoi', 'Ho Chi Minh', 'Da Nang', 'Singapore', 'Kuala Lumpur', 'Bali', 'Jakarta', 'Manila', 'Cebu',
  // HK / Macau
  '香港', '澳門',
  'Hong Kong', 'Macau',
]

/** Extract city from day title (e.g. "探索北京故宮" → "北京") */
function extractCityFromTitle(title: string): string | null {
  for (const city of CITY_NAMES) {
    if (title.includes(city)) return city
  }
  return null
}

interface PlaceWithAddress {
  address?: string
}

/** Get the best city name for a day's activities, falling back to trip destination.
 *  Priority: day title (most reliable for multi-city) → place addresses → trip destination */
export function getDayCity(places: PlaceWithAddress[], tripDestination: string, dayTitle?: string): string {
  // 1. Try extracting from day title (most reliable for multi-city trips)
  if (dayTitle) {
    const city = extractCityFromTitle(dayTitle)
    if (city) return city
  }
  // 2. Try from place addresses
  for (const place of places) {
    if (place.address) {
      const city = extractCityFromAddress(place.address)
      if (city) return city
    }
  }
  return tripDestination
}

interface Props {
  destination: string
  dayCity: string
  days: number
  language?: string
  tripId: string
  dayNumber: number
}

export function HotelSuggestion({ destination, dayCity, days, language, tripId, dayNumber }: Props) {
  const [aiLoading, setAiLoading] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [hotelName, setHotelName] = useState('')
  const [bookingLink, setBookingLink] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (days < 2) return null

  const isChinese = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'
  const showAgoda = isAsianDestination(dayCity) || isAsianDestination(destination)

  // Use per-day city for booking links so multi-city trips search the right city
  const googleUrl = buildGoogleHotelsUrl(dayCity)
  const bookingUrl = buildBookingUrl(dayCity)
  const agodaUrl = buildAgodaUrl(dayCity)

  async function handleAiRecommend() {
    setAiLoading(true)
    setError(null)
    try {
      const instruction = `Add a highly-rated hotel recommendation near the main itinerary area in ${dayCity}. Add it as the LAST place of Day ${dayNumber} with type "hotel". Set arrivalTime to 30 minutes after the last activity ends. Duration should be "${isChinese ? '入住' : 'Check-in'}". Description should be "${isChinese ? '回酒店休息' : 'Return to hotel'}". Include Google rating, price range, and a brief description. The hotel should be well-located for the planned activities.`
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
    } catch {
      setError(isChinese ? '推薦失敗，請重試' : 'Failed, please try again')
      setAiLoading(false)
    }
  }

  // Direct insert via /api/add-hotel — no AI call, instant
  async function handleAddHotel() {
    const name = hotelName.trim()
    if (!name) return
    setAddLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/add-hotel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, hotelName: name, dayNumber, language: language ?? 'en', bookingUrl: bookingLink.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed')
      }
      window.location.reload()
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

      {/* Manual hotel name input — direct insert, no AI */}
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

      {/* Optional booking link input */}
      {hotelName.trim() && (
        <input
          type="url"
          value={bookingLink}
          onChange={(e) => setBookingLink(e.target.value)}
          placeholder={isChinese ? '貼上訂房連結（選填）' : 'Paste booking link (optional)'}
          disabled={isLoading}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent disabled:opacity-50"
        />
      )}

      {/* Hint: nightlife activities */}
      <p className="text-xs text-gray-400 mt-2">
        {isChinese ? '💡 想加夜間活動？用下面嘅編輯框告訴 AI！' : '💡 Want to add nightlife? Use the edit box below!'}
      </p>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}
