'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TripLoadingOverlay } from '@/components/TripLoadingOverlay'

const SUGGESTIONS = [
  '一日遊 Long Beach，海鮮晚餐，情侶',
  '5日4夜 San Diego，SeaWorld，$$ 預算',
  "週末 San Francisco，Fisherman's Wharf，家庭",
  'SD day trip, seafood dinner, couple',
]

type ChipGroup = 'who' | 'style'
const PREFERENCE_CHIPS: { emoji: string; label: string; keyword: string; group: ChipGroup }[] = [
  // Who (exclusive — pick one)
  { emoji: '👫', label: 'With Partner', keyword: 'romantic couple', group: 'who' },
  { emoji: '👨‍👩‍👧', label: 'With Kids', keyword: 'family-friendly', group: 'who' },
  { emoji: '👨‍👩‍👦‍👦', label: 'With Friends', keyword: 'group of friends', group: 'who' },
  { emoji: '🧍', label: 'Solo', keyword: 'solo traveler', group: 'who' },
  // Style (multi-select)
  { emoji: '🍜', label: 'Foodie', keyword: 'food-focused', group: 'style' },
  { emoji: '💰', label: 'Budget', keyword: 'budget', group: 'style' },
  { emoji: '🌿', label: 'Relaxed', keyword: 'relaxed', group: 'style' },
  { emoji: '🎉', label: 'Nightlife', keyword: 'nightlife', group: 'style' },
]

// Client-side trip length detection for time estimates
function detectTripDays(prompt: string): number {
  if (/(一日|一天|day.?trip|1.?day|one.?day|1日|1天)/i.test(prompt)) return 1
  if (/(一週|一星期|a week|7.?day)/i.test(prompt)) return 7
  const arabicMatch = prompt.match(/(\d+)\s*[-–]?\s*(day|days|日|天|夜|nights?)/i)
  if (arabicMatch) return parseInt(arabicMatch[1], 10)
  const cnDigits: Record<string, number> = { '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 }
  for (const [char, val] of Object.entries(cnDigits)) {
    if (new RegExp(`${char}(日|天|夜|晚)`).test(prompt)) return val
  }
  const nightMatch = prompt.match(/(\d+)\s*night/i)
  if (nightMatch) return parseInt(nightMatch[1], 10) + 1
  return 2
}

function getEstimatedSeconds(days: number): number {
  if (days <= 1) return 29
  if (days <= 2) return 40
  if (days <= 3) return 55
  if (days <= 5) return 60
  return 90
}

const TRIP_VALIDATION_MSG = "Please describe a trip! Include a destination and how long.\nFor example: '3 days Tokyo food trip' or '一日遊 Long Beach 情侶'"

// Travel keywords that signal a valid trip request
const TRAVEL_KEYWORDS_EN = /\b(trip|day|days|night|nights|travel|vacation|holiday|itinerary|visit|tour|explore|weekend|getaway|sightseeing|road\s?trip|fly|flight|hotel|hostel|airbnb|resort|beach|hike|hiking)\b/i
const TRAVEL_KEYWORDS_ZH = /(日|天|夜|晚|旅行|旅遊|遊|行程|玩|景點|酒店|民宿|海灘|自由行|跟團|出發|機票|住宿|觀光|度假|週末)/

// Common destinations — not exhaustive, just enough to catch most valid requests
const DESTINATIONS = /\b(tokyo|osaka|kyoto|seoul|taipei|hong\s?kong|bangkok|singapore|bali|paris|london|rome|barcelona|amsterdam|new\s?york|nyc|los\s?angeles|la|san\s?francisco|sf|san\s?diego|sd|seattle|portland|denver|boston|miami|orlando|chicago|houston|austin|nashville|las\s?vegas|hawaii|maui|honolulu|cancun|mexico|london|berlin|prague|vienna|lisbon|dublin|istanbul|dubai|sydney|melbourne|vancouver|toronto|montreal|florence|venice|munich|zurich|geneva|nice|marseille|lyon|madrid|seville|athens|santorini|phuket|hanoi|ho\s?chi\s?minh|kuala\s?lumpur|manila|cebu|okinawa|fukuoka|nagoya|sapporo|busan|jeju|kaohsiung|tainan|taichung|macau|shenzhen|shanghai|beijing|chengdu|guangzhou|xi'?an|hangzhou|nanjing|suzhou|guilin|kunming|lijiang|zhangjiajie|long\s?beach|pasadena|santa\s?monica|beverly\s?hills|anaheim|irvine|san\s?jose|oakland|sacramento|phoenix|scottsdale|tucson|albuquerque|salt\s?lake|raleigh|charlotte|jacksonville|memphis|minneapolis|st\s?louis|new\s?orleans|pittsburgh|philadelphia|detroit|washington\s?d\.?c\.?|atlanta)\b/i
const DESTINATIONS_ZH = /(東京|大阪|京都|首爾|台北|香港|曼谷|新加坡|巴厘|巴黎|倫敦|羅馬|巴塞羅那|阿姆斯特丹|紐約|洛杉磯|舊金山|三藩市|聖地亞哥|西雅圖|邁阿密|芝加哥|夏威夷|沖繩|福岡|札幌|釜山|濟州|高雄|台南|台中|澳門|深圳|上海|北京|成都|廣州|西安|杭州|南京|蘇州|桂林|昆明|麗江|張家界)/

function isValidTripRequest(text: string): boolean {
  const trimmed = text.trim()
  // Too short — CJK characters carry more meaning, so use lower threshold
  const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(trimmed)
  if (trimmed.length < (hasCJK ? 3 : 5)) return false
  // Has a travel keyword
  if (TRAVEL_KEYWORDS_EN.test(trimmed) || TRAVEL_KEYWORDS_ZH.test(trimmed)) return true
  // Has a known destination
  if (DESTINATIONS.test(trimmed) || DESTINATIONS_ZH.test(trimmed)) return true
  // Has a number followed by something that looks like duration
  if (/\d+\s*[-–]?\s*(day|night|日|天|夜|晚)/i.test(trimmed)) return true
  return false
}

export type LoadingVibe = 'couple' | 'family' | 'food' | 'budget' | 'default'

function detectVibe(prompt: string, chips: Set<string>): LoadingVibe {
  if (chips.has('romantic couple') || /couple|romantic|date|情侶|約會/i.test(prompt)) return 'couple'
  if (chips.has('family-friendly') || /family|kids|children|家庭|小孩/i.test(prompt)) return 'family'
  if (chips.has('food-focused') || /food|foodie|美食|吃/i.test(prompt)) return 'food'
  if (chips.has('budget') || /budget|cheap|省錢|平/i.test(prompt)) return 'budget'
  return 'default'
}

export function ChatInput() {
  const [prompt, setPrompt] = useState('')
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<'generating' | 'validating' | 'optimizing' | 'saving'>('generating')
  const [estimatedSeconds, setEstimatedSeconds] = useState(120)
  const [loadingVibe, setLoadingVibe] = useState<LoadingVibe>('default')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const pendingTripIdRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()

  // Poll for trip completion — used as fallback when SSE disconnects
  const startPolling = useCallback((tripId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/trip/${tripId}`, { method: 'HEAD' })
        if (res.ok) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          pendingTripIdRef.current = null
          sessionStorage.removeItem('tg_pending_trip')
          router.push(`/trip/${tripId}`)
        }
      } catch {}
    }, 3000)
  }, [router])

  // Recovery when user switches back to the app
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      const tripId = pendingTripIdRef.current || sessionStorage.getItem('tg_pending_trip')
      if (!tripId) return
      // Trip was being generated — try to navigate directly (server saved it to Redis)
      pendingTripIdRef.current = tripId
      startPolling(tripId)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [startPolling])

  // On mount, check for an interrupted generation from a previous page load
  useEffect(() => {
    const tripId = sessionStorage.getItem('tg_pending_trip')
    if (!tripId) return
    // Check if this trip already exists — if so, redirect
    fetch(`/trip/${tripId}`, { method: 'HEAD' }).then(res => {
      if (res.ok) {
        sessionStorage.removeItem('tg_pending_trip')
        router.push(`/trip/${tripId}`)
      } else {
        // Trip doesn't exist yet, clear stale marker
        sessionStorage.removeItem('tg_pending_trip')
      }
    }).catch(() => {
      sessionStorage.removeItem('tg_pending_trip')
    })
  }, [router])
  // Detect language: simplified Chinese, traditional Chinese, or English
  const hasChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(prompt)
  // Simplified-only chars — each has a distinct Traditional counterpart (e.g. 简→簡, 体→體)
  // MUST NOT include chars common to both systems (了,的,是,不,人,我,去,看,etc.)
  const hasSimplified = /[简体这请让吗还对过们么说会觉来发现开关时间门东长几块钱飞机买点车线记顺须识语编码资浏览软厅录综历赛组词]/.test(prompt)
  const lang: 'en' | 'zh-TW' | 'zh-CN' = hasChinese ? (hasSimplified ? 'zh-CN' : 'zh-TW') : 'en'
  const isChinese = hasChinese

  function toggleChip(keyword: string) {
    const chip = PREFERENCE_CHIPS.find(c => c.keyword === keyword)
    if (!chip) return

    setActiveChips(prev => {
      const next = new Set(prev)
      if (next.has(keyword)) {
        next.delete(keyword)
      } else {
        // "Who" group is exclusive — deselect other "who" chips
        if (chip.group === 'who') {
          for (const c of PREFERENCE_CHIPS) {
            if (c.group === 'who') next.delete(c.keyword)
          }
        }
        next.add(keyword)
      }
      return next
    })
  }

  function getFullPrompt() {
    if (activeChips.size === 0) return prompt
    return `${prompt} [${[...activeChips].join(', ')}]`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    if (!isValidTripRequest(prompt)) {
      setError(TRIP_VALIDATION_MSG)
      return
    }

    setLoading(true)
    setLoadingPhase('generating')
    setEstimatedSeconds(getEstimatedSeconds(detectTripDays(prompt)))
    setLoadingVibe(detectVibe(prompt, activeChips))
    setError('')

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: getFullPrompt() }),
        signal: abortController.signal,
      })

      // Early validation errors come back as plain JSON (400), not a stream
      if (!res.ok) {
        let msg = 'Unable to generate itinerary. Please try again or rephrase your request.'
        try {
          const data = await res.json()
          const raw = data.error ?? ''
          if (raw.includes('Unable to generate') || raw.includes('rephrase') || raw.includes('too long') || raw.includes('Please describe')) {
            msg = raw
          }
        } catch {}
        throw new Error(msg)
      }

      if (!res.body) throw new Error('Server error. Please try again.')

      // Read SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })

        // SSE events are separated by \n\n
        const events = buf.split('\n\n')
        buf = events.pop() ?? ''

        for (const raw of events) {
          const line = raw.trim()
          if (!line.startsWith('data: ')) continue
          let event: { type: string; tripId?: string; message?: string }
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === 'preview' && event.tripId) {
            // Trip saved to Redis — remember ID for app-switch recovery
            pendingTripIdRef.current = event.tripId
            sessionStorage.setItem('tg_pending_trip', event.tripId)
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            router.push(`/trip/${event.tripId}`)
            return
          }
          if (event.type === 'done' && event.tripId) {
            pendingTripIdRef.current = null
            sessionStorage.removeItem('tg_pending_trip')
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            router.push(`/trip/${event.tripId}`)
            return
          }
          if (event.type === 'error') {
            throw new Error(event.message ?? 'Generation failed. Please try again.')
          }
          if (event.type === 'validating') {
            setLoadingPhase('validating')
          }
          if (event.type === 'optimizing') {
            setLoadingPhase('optimizing')
          }
          if (event.type === 'saving') {
            setLoadingPhase('saving')
          }
          // 'chunk' and 'heartbeat' events: no-op — just keepalives
        }
      }

      throw new Error('Server error. Please try again.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — silently reset
        setLoading(false)
        return
      }
      // If we have a pending tripId, the trip may have been saved to Redis
      // even though the SSE stream disconnected (e.g. app switch on mobile)
      const pendingId = pendingTripIdRef.current || sessionStorage.getItem('tg_pending_trip')
      if (pendingId) {
        // Start polling — the trip might finish in the background
        startPolling(pendingId)
        return // keep loading overlay visible while polling
      }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    } finally {
      abortRef.current = null
    }
  }

  return (
    <div className="w-full max-w-xl lg:max-w-3xl mx-auto px-4">
      {loading && <TripLoadingOverlay lang={lang} phase={loadingPhase} estimatedSeconds={estimatedSeconds} vibe={loadingVibe} onCancel={() => abortRef.current?.abort()} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={'Describe your trip... e.g. 5-day San Diego with SeaWorld, seafood restaurants, couple / 描述你的旅行計劃...'}
          aria-label="Describe your trip / 描述你的旅行計劃"
          rows={4}
          maxLength={500}
          disabled={loading}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
          className="w-full border border-gray-200 rounded-xl p-4 text-base lg:text-lg lg:p-5 lg:min-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange disabled:opacity-50"
        />

        {/* Preference chips — Who (exclusive) */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Who&apos;s going?</p>
          <div className="flex flex-wrap gap-2">
            {PREFERENCE_CHIPS.filter(c => c.group === 'who').map(chip => {
              const active = activeChips.has(chip.keyword)
              return (
                <button
                  key={chip.keyword}
                  type="button"
                  onClick={() => toggleChip(chip.keyword)}
                  disabled={loading}
                  className={`text-xs lg:text-sm rounded-full px-3 py-1.5 lg:px-4 lg:py-2 min-h-[36px] lg:min-h-[40px] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/50 ${
                    active
                      ? 'bg-orange text-white border border-orange'
                      : 'border border-gray-200 hover:border-orange hover:text-orange'
                  }`}
                >
                  {chip.emoji} {chip.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Preference chips — Style (multi-select) */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Trip style</p>
          <div className="flex flex-wrap gap-2">
            {PREFERENCE_CHIPS.filter(c => c.group === 'style').map(chip => {
              const active = activeChips.has(chip.keyword)
              return (
                <button
                  key={chip.keyword}
                  type="button"
                  onClick={() => toggleChip(chip.keyword)}
                  disabled={loading}
                  className={`text-xs lg:text-sm rounded-full px-3 py-1.5 lg:px-4 lg:py-2 min-h-[36px] lg:min-h-[40px] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/50 ${
                    active
                      ? 'bg-orange text-white border border-orange'
                      : 'border border-gray-200 hover:border-orange hover:text-orange'
                  }`}
                >
                  {chip.emoji} {chip.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              disabled={loading}
              className="text-xs lg:text-sm border border-gray-200 rounded-full px-3 py-2 lg:px-4 lg:py-2.5 min-h-[44px] hover:border-orange hover:text-orange transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/50"
            >
              {s}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="w-full bg-orange text-white py-3 lg:py-4 rounded-xl font-semibold text-sm lg:text-base disabled:opacity-50 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
        >
          {loading ? '⏳ Generating... / 生成中...' : '✨ Generate Itinerary / 生成行程'}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm text-red-600 mb-3">⚠️ {error}</p>
          <button
            type="button"
            onClick={() => { setError(''); handleSubmit({ preventDefault: () => {} } as React.FormEvent) }}
            className="w-full bg-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Try Again / 重試
          </button>
        </div>
      )}
    </div>
  )
}
