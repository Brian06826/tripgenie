'use client'
import { useState } from 'react'

export function ShareButton({ tripId }: { tripId: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/trip/${tripId}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 bg-orange px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
    >
      {copied ? '✅ 已複製!' : '📋 複製連結'}
    </button>
  )
}
