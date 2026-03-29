'use client'
import { useEffect, useState } from 'react'
import type { LoadingVibe } from './ChatInput'

const MSGS: Record<string, { en: string[]; zh: string[] }> = {
  default: {
    en: [
      'Packing your bags... 🧳',
      'Booking the best restaurants... 🍜',
      'Finding hidden gems... 💎',
      'Checking the weather forecast... ☀️',
      'Negotiating with locals... 🗣️',
      'Planning the perfect route... 🗺️',
      'Asking locals for secret spots... 🤫',
      'Comparing all the reviews... ⭐',
      'Scanning for must-try dishes... 🥢',
      'Reserving the best views... 🏔️',
      'Verifying restaurants on Google... ✅',
      'Optimizing your route... 📍',
    ],
    zh: [
      '整理緊行李... 🧳',
      '預訂最好嘅餐廳... 🍜',
      '搵緊隱藏寶藏... 💎',
      '查緊天氣預報... ☀️',
      '同當地人溝通緊... 🗣️',
      '規劃完美路線... 🗺️',
      '問當地人秘密景點... 🤫',
      '比較各大評分... ⭐',
      '搵緊必試美食... 🥢',
      '預留最靚嘅景色... 🏔️',
      '喺 Google 驗證餐廳緊... ✅',
      '優化你嘅路線... 📍',
    ],
  },
  couple: {
    en: [
      'Finding the most romantic spots... 💑',
      'Reserving the best sunset views... 🌅',
      'Scouting cozy date-night restaurants... 🕯️',
      'Planning the perfect scenic walk... 🌸',
      'Finding hidden rooftop bars... 🍷',
      'Checking the best photo spots... 📸',
    ],
    zh: [
      '搵緊最浪漫嘅地方... 💑',
      '預留最靚嘅日落景色... 🌅',
      '搵緊氣氛好嘅約會餐廳... 🕯️',
      '規劃完美散步路線... 🌸',
      '搵緊隱世天台酒吧... 🍷',
      '搵緊最佳打卡位... 📸',
    ],
  },
  family: {
    en: [
      'Finding kid-friendly activities... 👨‍👩‍👧',
      'Making sure there\'s something for everyone... 🎠',
      'Checking playground ratings... 🛝',
      'Finding family-friendly restaurants... 🍕',
      'Planning rest stops between activities... 😴',
      'Scouting the best ice cream shops... 🍦',
    ],
    zh: [
      '搵緊適合小朋友嘅活動... 👨‍👩‍👧',
      '確保大人細路都開心... 🎠',
      '搵緊親子餐廳... 🍕',
      '計劃活動之間嘅休息時間... 😴',
      '搵緊最好嘅雪糕店... 🍦',
      '搵緊公園同遊樂場... 🛝',
    ],
  },
  food: {
    en: [
      'Hunting down the best local eats... 🍜',
      'Reading thousands of reviews... ⭐',
      'Finding the hidden foodie gems... 🥢',
      'Checking which spots have lines out the door... 🚪',
      'Scouting the best street food... 🌮',
      'Comparing Michelin and hole-in-the-wall picks... 🏆',
    ],
    zh: [
      '搵緊最正嘅地道美食... 🍜',
      '睇緊過千條評論... ⭐',
      '搵緊隱世美食... 🥢',
      '搵緊排隊名店... 🚪',
      '搵緊最好嘅街頭小食... 🌮',
      '比較米芝蓮同街坊小店... 🏆',
    ],
  },
  budget: {
    en: [
      'Finding the best free attractions... 💰',
      'Maximizing fun, minimizing cost... 🎯',
      'Scouting the cheapest eats with the best reviews... 🌟',
      'Finding happy hour deals... 🍻',
      'Checking for free museum days... 🎨',
      'Planning the most efficient route to save on transport... 🚶',
    ],
    zh: [
      '搵緊最抵玩嘅免費景點... 💰',
      '用最少錢玩最多嘢... 🎯',
      '搵緊平靚正嘅餐廳... 🌟',
      '搵緊 happy hour 優惠... 🍻',
      '搵緊免費博物館日... 🎨',
      '規劃最慳錢嘅路線... 🚶',
    ],
  },
}

// Static positions — no Math.random() to avoid hydration mismatches
const STARS: [number, number, number][] = [
  [7, 4, 2], [12, 18, 1.5], [5, 33, 2], [19, 47, 1], [9, 61, 2.5],
  [14, 75, 1.5], [22, 88, 2], [30, 10, 1], [28, 29, 2], [35, 52, 1.5],
  [41, 70, 1], [38, 84, 2], [50, 6, 1.5], [55, 43, 2], [48, 93, 1],
]

interface Props {
  isChinese: boolean
  phase: 'generating' | 'validating' | 'optimizing' | 'saving'
  estimatedSeconds: number
  vibe?: LoadingVibe
  onCancel?: () => void
}

export function TripLoadingOverlay({ isChinese, phase, estimatedSeconds, vibe = 'default', onCancel }: Props) {
  const vibeSet = MSGS[vibe] ?? MSGS.default
  const msgs = isChinese ? vibeSet.zh : vibeSet.en
  const [idx, setIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [progress, setProgress] = useState(4)

  // Rotate messages every 3 seconds
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % msgs.length), 3000)
    return () => clearInterval(t)
  }, [msgs.length])

  // Elapsed time counter
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Phase-based progress targets
  const phaseCap = phase === 'saving' ? 96
    : phase === 'optimizing' ? 90
    : phase === 'validating' ? 78
    : 60 // generating

  // Fake progress — scale speed to estimated time
  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= phaseCap) return phaseCap
        // Scale progress speed to estimated time, with a floor so it never crawls
        const step = p < 30 ? 2.5 : p < 55 ? 1.5 : p < 75 ? 0.8 : 0.4
        const speedFactor = Math.max(0.3, 30 / estimatedSeconds)
        return Math.min(p + step * speedFactor, phaseCap)
      })
    }, 900)
    return () => clearInterval(t)
  }, [phaseCap, estimatedSeconds])

  // Jump progress when phase advances
  useEffect(() => {
    if (phase === 'validating') setProgress(p => Math.max(p, 62))
    if (phase === 'optimizing') setProgress(p => Math.max(p, 80))
    if (phase === 'saving') setProgress(p => Math.max(p, 88))
  }, [phase])

  const phaseMsg = phase === 'saving'
    ? (isChinese ? '生成分享頁面緊... ✨' : 'Generating your shareable page... ✨')
    : phase === 'optimizing'
    ? (isChinese ? '優化你嘅路線... 📍' : 'Optimizing your route... 📍')
    : phase === 'validating'
    ? (isChinese ? '喺 Google 驗證餐廳緊... ✅' : 'Verifying restaurants on Google... ✅')
    : null
  const displayMsg = phaseMsg ?? msgs[idx]
  const msgKey = phaseMsg ? phase : idx

  // Format estimated time for display
  const estLabel = estimatedSeconds >= 60
    ? `~${Math.round(estimatedSeconds / 60)} min`
    : `~${estimatedSeconds}s`

  // Format elapsed
  const elapsedLabel = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m ${(elapsed % 60).toString().padStart(2, '0')}s`
    : `${elapsed}s`

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none"
      style={{ background: 'linear-gradient(160deg, #091b2e 0%, #1a3a5c 50%, #2d5a8e 100%)' }}
      aria-live="polite"
      aria-label={isChinese ? '正在生成行程' : 'Generating your trip'}
    >
      {/* Star field */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {STARS.map(([top, left, size], i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ top: `${top}%`, left: `${left}%`, width: size, height: size, opacity: 0.22 }}
          />
        ))}
      </div>

      {/* Plane flight zone */}
      <div className="relative w-full mt-14" style={{ height: 88 }}>
        {/* Dashed flight path */}
        <div
          className="absolute left-0 right-0"
          style={{ top: '50%', borderTop: '1px dashed rgba(255,255,255,0.13)' }}
          aria-hidden
        />

        {/* Floating clouds */}
        <span
          className="absolute text-xl pointer-events-none"
          style={{ top: '10%', left: '10%', opacity: 0.28, animation: 'tgCloudFloat 8s ease-in-out infinite' }}
          aria-hidden
        >☁️</span>
        <span
          className="absolute text-lg pointer-events-none"
          style={{ top: '55%', left: '52%', opacity: 0.18, animation: 'tgCloudFloat 10s ease-in-out infinite reverse' }}
          aria-hidden
        >☁️</span>
        <span
          className="absolute text-2xl pointer-events-none"
          style={{ top: '8%', left: '80%', opacity: 0.22, animation: 'tgCloudFloat 7s ease-in-out infinite 1s' }}
          aria-hidden
        >☁️</span>

        {/* Animated plane — outer div moves horizontally, inner bobs vertically */}
        <div
          className="tg-plane-fly absolute pointer-events-none"
          style={{ top: 'calc(50% - 20px)' }}
          aria-hidden
        >
          <div
            className="tg-plane-bob text-4xl leading-none"
            style={{ filter: 'drop-shadow(0 0 12px rgba(255,140,66,0.85))' }}
          >
            ✈️
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-10">
        <p className="text-white/40 text-xs tracking-[0.18em] uppercase font-semibold mb-4">
          TripGenie ✨
        </p>
        <h2 className="text-white text-2xl font-bold mb-2">
          {isChinese ? '為你規劃行程中' : 'Crafting your itinerary'}
        </h2>
        <p className="text-white/40 text-sm mb-10">
          {isChinese
            ? '請稍等，精彩行程快完成了'
            : 'Hang tight, your perfect trip is almost ready'}
        </p>

        {/* Rotating message — key change triggers CSS fade-in */}
        <div className="flex items-center justify-center mb-10" style={{ minHeight: '2rem' }}>
          <span key={msgKey} className="tg-msg-fadein text-white/85 text-base font-medium">
            {displayMsg}
          </span>
        </div>

        {/* Progress bar + timer */}
        <div className="w-72 max-w-xs mx-auto">
          <div className="bg-white/10 rounded-full overflow-hidden mb-2.5" style={{ height: 6 }}>
            <div
              className="h-full rounded-full transition-all duration-[900ms] ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #ff8c42 0%, #ffb347 100%)',
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/30 text-xs">
              {phase === 'saving'
                ? (isChinese ? '保存行程中...' : 'Saving your trip...')
                : phase === 'optimizing'
                ? (isChinese ? '優化路線中...' : 'Optimizing routes...')
                : phase === 'validating'
                ? (isChinese ? '驗證餐廳中...' : 'Verifying restaurants...')
                : (isChinese ? 'AI 生成緊...' : 'AI is working its magic...')}
            </span>
            <span className="text-white/40 text-xs tabular-nums">
              ⏱️ {elapsedLabel} / {estLabel}
            </span>
          </div>
        </div>

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-8 text-white/40 text-xs hover:text-white/70 transition-colors underline underline-offset-2"
          >
            {isChinese ? '取消' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}
