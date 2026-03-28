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
      aria-label={copied ? 'Link copied' : 'Copy trip link'}
      className="flex items-center gap-2 bg-orange px-4 min-h-[44px] rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
    >
      {copied ? '✅ 已複製!' : '📋 複製連結'}
    </button>
  )
}
