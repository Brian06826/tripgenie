'use client'
import { useState, useRef, useEffect } from 'react'

function generateQrSvg(data: string, size: number): string {
  // Simple QR code using a canvas-free approach: redirect to Google Charts API
  // This is a lightweight solution that works without any npm dependency
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8`
}

export function ShareButton({ tripId, tripTitle }: { tripId: string; tripTitle?: string }) {
  const [showPanel, setShowPanel] = useState(false)
  const [copied, setCopied] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/trip/${tripId}`

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPanel])

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripTitle ?? 'My Trip',
          text: `Check out my trip itinerary!`,
          url,
        })
      } catch {
        // User cancelled or share failed — fall back to copy
        handleCopy()
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        aria-label="Share trip"
        className="flex items-center gap-2 bg-orange px-4 min-h-[44px] rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
      >
        📤 Share
      </button>

      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* QR Code */}
          <div className="flex flex-col items-center mb-3">
            <p className="text-xs text-gray-500 mb-2 font-medium">Scan to view / 掃碼查看</p>
            <img
              src={generateQrSvg(url, 160)}
              alt="QR code for trip"
              width={160}
              height={160}
              className="rounded-lg border border-gray-100"
            />
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-700 py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors min-h-[44px]"
            >
              {copied ? '✅ Copied!' : '📋 Copy Link / 複製連結'}
            </button>
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-2.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors min-h-[44px]"
            >
              📱 Share via App / 分享到應用
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
