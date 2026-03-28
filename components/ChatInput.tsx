'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TripLoadingOverlay } from '@/components/TripLoadingOverlay'

const SUGGESTIONS = [
  '一日遊 Long Beach，海鮮晚餐，情侶',
  '5日4夜 San Diego，SeaWorld，$$ 預算',
  "週末 San Francisco，Fisherman's Wharf，家庭",
  'SD day trip, seafood dinner, couple',
]

export function ChatInput() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<'generating' | 'saving'>('generating')
  const [error, setError] = useState('')
  const router = useRouter()
  const isChinese = /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/.test(prompt)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    setLoading(true)
    setLoadingPhase('generating')
    setError('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
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

          if (event.type === 'done' && event.tripId) {
            router.push(`/trip/${event.tripId}`)
            return
          }
          if (event.type === 'error') {
            throw new Error(event.message ?? 'Generation failed. Please try again.')
          }
          if (event.type === 'saving') {
            setLoadingPhase('saving')
          }
          // 'chunk' and 'heartbeat' events: no-op — just keepalives
        }
      }

      throw new Error('Server error. Please try again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    } finally {
      // nothing to clean up
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4">
      {loading && <TripLoadingOverlay isChinese={isChinese} phase={loadingPhase} />}
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
          className="w-full border border-gray-200 rounded-xl p-4 text-base resize-none focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange disabled:opacity-50"
        />

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              disabled={loading}
              className="text-xs border border-gray-200 rounded-full px-3 py-2 min-h-[44px] hover:border-orange hover:text-orange transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/50"
            >
              {s}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="w-full bg-orange text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
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
