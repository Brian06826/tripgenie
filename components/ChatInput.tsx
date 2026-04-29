'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TripLoadingOverlay } from '@/components/TripLoadingOverlay'
import { PaywallModal } from '@/components/PaywallModal'
import { useUILocale } from '@/lib/i18n-context'
import { t, isChinese as isChineseLocale } from '@/lib/i18n'
import { isNative } from '@/lib/native'

const ROTATING_PLACEHOLDERS = [
  '"3 days Tokyo food trip"',
  '"週末台北夜市之旅"',
  '"5 days Italy, romantic, $$"',
  '"Seoul 3 days, girls trip"',
  '"一日遊 San Diego，家庭"',
  '"London weekend, budget, solo"',
]

type ChipGroup = 'who' | 'style'
const PREFERENCE_CHIPS: { emoji: string; i18nKey: string; keyword: string; group: ChipGroup }[] = [
  // Who (exclusive — pick one)
  { emoji: '👫', i18nKey: 'chip.partner', keyword: 'romantic couple', group: 'who' },
  { emoji: '👨‍👩‍👧', i18nKey: 'chip.kids', keyword: 'family-friendly', group: 'who' },
  { emoji: '👨‍👩‍👦‍👦', i18nKey: 'chip.friends', keyword: 'group of friends', group: 'who' },
  { emoji: '🧍', i18nKey: 'chip.solo', keyword: 'solo traveler', group: 'who' },
  // Style (multi-select)
  { emoji: '🍜', i18nKey: 'chip.foodie', keyword: 'food-focused', group: 'style' },
  { emoji: '💰', i18nKey: 'chip.budget', keyword: 'budget', group: 'style' },
  { emoji: '🌿', i18nKey: 'chip.relaxed', keyword: 'relaxed', group: 'style' },
  { emoji: '🎉', i18nKey: 'chip.nightlife', keyword: 'nightlife', group: 'style' },
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
  // Used internally for progress curve pacing + overtime detection (not displayed to user)
  if (days <= 1) return 35
  if (days <= 2) return 55
  if (days <= 3) return 70
  if (days <= 5) return 90
  return 120
}

const TRIP_VALIDATION_MSG = "Please describe a trip! Include a destination and how long.\nFor example: '3 days Tokyo food trip' or '一日遊 Long Beach 情侶'"

// Lenient validation — only reject obviously non-trip inputs.
// Let Claude handle ambiguous requests rather than blocking at the frontend.
const NON_TRIP_PATTERNS = /^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|yes|no|bye|goodbye|how are you|what is|what's|who is|who are|tell me a joke|help me with|write me|explain|define|translate this|calculate|what time|good morning|good night|test|testing|asdf|aaa)[\s!?.]*$/i

// Patterns that signal a non-trip request even in longer inputs
const NON_TRIP_LONG = /\b(essay|homework|write me|code|recipe|review this|explain the|history of|best countries|translate|summarize|who is the)\b/i

// Positive trip signals — at least one must be present for longer inputs
const TRIP_SIGNALS = /\b(go|going|want|wanna|plan|visit|trip|travel|fly|stay|from|to|day|days|night|nights|week|weeks|vacation|holiday|itinerary|tour|explore|weekend|getaway|beach|hotel|hostel|resort|budget|solo|couple|family|food|restaurant|sightseeing|backpack|honeymoon|anniversary|road\s?trip|airport|flight)\b/i
const TRIP_SIGNALS_ZH = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/

function isValidTripRequest(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 2) return false
  // Reject obvious short non-trip inputs (greetings, generic questions)
  if (NON_TRIP_PATTERNS.test(trimmed)) return false
  // Reject longer inputs that are clearly not trip requests
  if (NON_TRIP_LONG.test(trimmed)) return false
  // Accept if it contains CJK characters (likely a valid request in Chinese/Japanese/Korean)
  if (TRIP_SIGNALS_ZH.test(trimmed)) return true
  // Accept if it contains any trip-related signal word
  if (TRIP_SIGNALS.test(trimmed)) return true
  // Accept if it contains dates or numbers with context (not bare math)
  if (/\d+\s*[-–\/]\s*\d+/.test(trimmed) || /\d+\s*(day|night|week|hour)/i.test(trimmed)) return true
  // Long input with no trip signals — let it through if 30+ chars (benefit of the doubt)
  if (trimmed.length >= 30) return true
  // Short English without any signals — reject
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
  const [showPreferences, setShowPreferences] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<'generating' | 'validating' | 'optimizing' | 'saving'>('generating')
  const [estimatedSeconds, setEstimatedSeconds] = useState(120)
  const [loadingVibe, setLoadingVibe] = useState<LoadingVibe>('default')
  const [dayProgress, setDayProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [placeholderVisible, setPlaceholderVisible] = useState(true)
  const [showPaywall, setShowPaywall] = useState(false)
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number } | null>(null)
  const [paymentToast, setPaymentToast] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pendingTripIdRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useUILocale()

  // Pre-fill from ?dest= query param (viral CTA from shared trips)
  useEffect(() => {
    const dest = searchParams.get('dest')
    const days = searchParams.get('days')
    if (dest) {
      const prefill = days ? `${days} days ${dest}` : dest
      setPrompt(prefill)
    }
  }, [searchParams])

  // Rotating placeholder
  useEffect(() => {
    if (prompt) return // Don't rotate when user is typing
    const interval = setInterval(() => {
      setPlaceholderVisible(false)
      setTimeout(() => {
        setPlaceholderIdx(prev => (prev + 1) % ROTATING_PLACEHOLDERS.length)
        setPlaceholderVisible(true)
      }, 300)
    }, 4000)
    return () => clearInterval(interval)
  }, [prompt])

  // Poll for trip completion via status endpoint
  const startPolling = useCallback((tripId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/trip-status/${tripId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'ready') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          pendingTripIdRef.current = null
          sessionStorage.removeItem('tg_pending_trip')
          router.push(`/trip/${tripId}`)
        }
        // status === 'generating' → keep polling
      } catch {}
    }, 3000)
  }, [router])

  // Recovery when user switches back to the app
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      // Clear stale errors from SSE disconnect (e.g. iOS "Load failed")
      setError('')
      const tripId = pendingTripIdRef.current || sessionStorage.getItem('tg_pending_trip')
      if (!tripId) return
      // Trip was being generated — poll for completion
      pendingTripIdRef.current = tripId
      setLoading(true)
      setLoadingPhase('generating')
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
    fetch(`/api/trip-status/${tripId}`).then(res => res.json()).then(data => {
      if (data.status === 'ready') {
        sessionStorage.removeItem('tg_pending_trip')
        router.push(`/trip/${tripId}`)
      } else if (data.status === 'generating') {
        // Still generating — show loading and poll
        pendingTripIdRef.current = tripId
        setLoading(true)
        setLoadingPhase('generating')
        startPolling(tripId)
      } else {
        sessionStorage.removeItem('tg_pending_trip')
      }
    }).catch(() => {
      sessionStorage.removeItem('tg_pending_trip')
    })
  }, [router, startPolling])
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
      setError(t(locale, 'chat.validation'))
      return
    }

    setLoading(true)
    setLoadingPhase('generating')
    setEstimatedSeconds(getEstimatedSeconds(detectTripDays(prompt)))
    setLoadingVibe(detectVibe(prompt, activeChips))
    setDayProgress(null)
    setError('')

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: getFullPrompt(), language: locale, native: isNative() }),
        signal: abortController.signal,
      })

      // Early validation errors come back as plain JSON (400), not a stream
      if (!res.ok) {
        let msg = 'Unable to generate itinerary. Please try again or rephrase your request.'
        try {
          const data = await res.json()
          if (data.error === 'usage_limit') {
            setUsageInfo({ used: data.used ?? 0, limit: data.limit ?? 4 })
            setShowPaywall(true)
            setLoading(false)
            return
          }
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
          let event: { type: string; tripId?: string; message?: string; dayNumber?: number; totalDays?: number }
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === 'tripId' && event.tripId) {
            // Server generated tripId upfront — save for recovery
            pendingTripIdRef.current = event.tripId
            sessionStorage.setItem('tg_pending_trip', event.tripId)
          }
          if (event.type === 'preview' && event.tripId) {
            // Trip saved to Redis — navigate immediately
            pendingTripIdRef.current = null
            sessionStorage.removeItem('tg_pending_trip')
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
          if (event.type === 'progress' && event.dayNumber && event.totalDays) {
            setDayProgress({ current: event.dayNumber, total: event.totalDays })
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
      // If we have a pending tripId, the server continues generating in the background.
      // Poll the status endpoint until the trip is ready.
      const pendingId = pendingTripIdRef.current || sessionStorage.getItem('tg_pending_trip')
      if (pendingId) {
        startPolling(pendingId)
        return // keep loading overlay visible while polling
      }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    } finally {
      abortRef.current = null
    }
  }

  // Handle payment success/cancel query params
  useEffect(() => {
    const payment = searchParams.get('payment')
    if (payment === 'success') {
      setError('')
      // Verify payment and add credits (fallback — don't rely on webhook alone)
      const sessionId = searchParams.get('session_id')
      if (sessionId) {
        fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        }).then(res => res.json()).then(data => {
          if (data.ok) {
            setPaymentToast(t(locale, 'paywall.success'))
            setTimeout(() => setPaymentToast(null), 5000)
          } else {
            console.error('Payment verification:', data)
          }
        }).catch(err => {
          console.error('Payment verification failed:', err)
        })
      } else {
        // No session_id but payment=success — show toast anyway (webhook may have handled it)
        setPaymentToast(t(locale, 'paywall.success'))
        setTimeout(() => setPaymentToast(null), 5000)
      }
      // Clean up URL
      const timer = setTimeout(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('payment')
        url.searchParams.delete('session_id')
        window.history.replaceState({}, '', url.toString())
      }, 100)
      return () => clearTimeout(timer)
    }
    if (payment === 'cancel') {
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  return (
    <div className="w-full">
      {loading && <TripLoadingOverlay lang={locale} phase={loadingPhase} estimatedSeconds={estimatedSeconds} vibe={loadingVibe} prompt={prompt} dayProgress={dayProgress} totalDays={detectTripDays(prompt)} onCancel={() => abortRef.current?.abort()} />}
      {showPaywall && usageInfo && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          used={usageInfo.used}
          limit={usageInfo.limit}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Textarea with rotating placeholder overlay */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            aria-label={t(locale, 'chat.ariaLabel')}
            rows={2}
            maxLength={500}
            disabled={loading}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
            className="w-full border border-gray-200 rounded-xl p-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange disabled:opacity-50"
          />
          {/* Custom rotating placeholder */}
          {!prompt && (
            <div
              className="absolute top-0 left-0 p-3 text-sm lg:text-base text-gray-400 pointer-events-none transition-opacity duration-300"
              style={{ opacity: placeholderVisible ? 1 : 0 }}
            >
              {ROTATING_PLACEHOLDERS[placeholderIdx]}
            </div>
          )}
        </div>

        {/* Collapsible preference chips */}
        <div
          className="overflow-hidden transition-all duration-200 ease-out"
          style={{ maxHeight: showPreferences ? '200px' : '0', opacity: showPreferences ? 1 : 0 }}
        >
          <div className="space-y-2 pt-0.5 pb-1">
            {/* Who (exclusive) */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t(locale, 'chat.whoGoing')}</p>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_CHIPS.filter(c => c.group === 'who').map(chip => {
                  const active = activeChips.has(chip.keyword)
                  return (
                    <button
                      key={chip.keyword}
                      type="button"
                      onClick={() => toggleChip(chip.keyword)}
                      disabled={loading}
                      className={`text-xs rounded-full px-2.5 py-1.5 transition-colors disabled:opacity-50 ${
                        active
                          ? 'bg-orange text-white border border-orange'
                          : 'border border-gray-200 hover:border-orange hover:text-orange'
                      }`}
                    >
                      {chip.emoji} {t(locale, chip.i18nKey as any)}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Style (multi-select) */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t(locale, 'chat.tripStyle')}</p>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_CHIPS.filter(c => c.group === 'style').map(chip => {
                  const active = activeChips.has(chip.keyword)
                  return (
                    <button
                      key={chip.keyword}
                      type="button"
                      onClick={() => toggleChip(chip.keyword)}
                      disabled={loading}
                      className={`text-xs rounded-full px-2.5 py-1.5 transition-colors disabled:opacity-50 ${
                        active
                          ? 'bg-orange text-white border border-orange'
                          : 'border border-gray-200 hover:border-orange hover:text-orange'
                      }`}
                    >
                      {chip.emoji} {t(locale, chip.i18nKey as any)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="w-full bg-orange text-white py-2.5 lg:py-3 rounded-xl font-semibold text-sm lg:text-base disabled:opacity-50 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
        >
          {loading ? t(locale, 'chat.generating') : t(locale, 'chat.cta')}
        </button>

        {/* Add preferences toggle */}
        {!showPreferences && (
          <button
            type="button"
            onClick={() => setShowPreferences(true)}
            className="w-full text-xs text-gray-400 hover:text-orange transition-colors py-0.5"
          >
            {t(locale, 'chat.addPrefs')}
          </button>
        )}
      </form>

      {/* Error state */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button
            type="button"
            onClick={() => { setError(''); handleSubmit({ preventDefault: () => {} } as React.FormEvent) }}
            className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            {t(locale, 'chat.tryAgain')}
          </button>
        </div>
      )}

      {/* Payment success toast */}
      {paymentToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <span>{paymentToast}</span>
          <button
            onClick={() => setPaymentToast(null)}
            className="ml-2 text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
