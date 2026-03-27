'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const LOADING_MESSAGES = [
  '🔍 搜尋最佳餐廳中... / Finding the best restaurants...',
  '📍 整理地點資訊... / Organizing places...',
  '🅿️ 搵緊泊車資訊... / Looking up parking...',
  '⭐ 確認 Yelp + Google 評分... / Checking ratings...',
  '✨ 生成分享頁面... / Building your itinerary...',
]

const SUGGESTIONS = [
  '一日遊 Long Beach，海鮮晚餐，情侶',
  '5日4夜 San Diego，SeaWorld，$$ 預算',
  "週末 San Francisco，Fisherman's Wharf，家庭",
  'SD day trip, seafood dinner, couple',
]

export function ChatInput() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingMsg, setLoadingMsg] = useState(0)
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    setLoading(true)
    setError('')
    setLoadingMsg(0)

    // Rotate loading messages
    intervalRef.current = setInterval(() => {
      setLoadingMsg(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 3000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Generation failed')
      }

      router.push(`/trip/${data.tripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={'描述你的旅行計劃... 例如：5日4夜 San Diego，一日去 SeaWorld，要海鮮餐廳，情侶旅行\n\nOr in English: 5-day San Diego trip, one day at SeaWorld, seafood restaurants, couple'}
          rows={4}
          maxLength={500}
          disabled={loading}
          className="w-full border border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange disabled:opacity-50"
        />

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              disabled={loading}
              className="text-xs border border-gray-200 rounded-full px-3 py-1 hover:border-orange hover:text-orange transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="w-full bg-orange text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {loading ? '⏳ 生成中...' : '✨ 生成行程 / Generate Itinerary'}
        </button>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="mt-4 text-center">
          <div className="text-sm text-gray-500 animate-pulse">
            {LOADING_MESSAGES[loadingMsg]}
          </div>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-orange h-1.5 rounded-full"
              style={{ animation: 'loadprogress 20s linear forwards' }}
            />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
