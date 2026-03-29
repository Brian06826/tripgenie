'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

function generateQrSvg(data: string, size: number): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8`
}

export function ShareButton({ tripId, tripTitle }: { tripId: string; tripTitle?: string }) {
  const [showPanel, setShowPanel] = useState(false)
  const [copied, setCopied] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/trip/${tripId}`

  // Position the panel below the button using fixed positioning
  // so it escapes any overflow-hidden ancestor
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPanelPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    })
  }, [])

  useEffect(() => {
    if (!showPanel) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [showPanel, updatePosition])

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
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
    <>
      <button
        ref={buttonRef}
        onClick={() => setShowPanel(!showPanel)}
        aria-label="Share trip"
        className="flex items-center gap-2 bg-orange px-4 min-h-[44px] rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
      >
        📤 Share
      </button>

      {showPanel && panelPos && (
        <div
          ref={panelRef}
          className="fixed w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ top: panelPos.top, right: panelPos.right }}
        >
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
    </>
  )
}
