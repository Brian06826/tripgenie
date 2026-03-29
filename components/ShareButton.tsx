'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

function generateQrSvg(data: string, size: number): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8`
}

export function ShareButton({ tripId, tripTitle }: { tripId: string; tripTitle?: string }) {
  const [showPanel, setShowPanel] = useState(false)
  const [copied, setCopied] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/trip/${tripId}` : `/trip/${tripId}`

  // Track client mount for portal
  useEffect(() => { setMounted(true) }, [])

  // Position the panel below the button
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    // Panel is 288px wide (w-72). Align right edge to button right edge.
    const right = window.innerWidth - rect.right
    // If panel would overflow left side, align to left edge instead
    const panelWidth = 288
    let left: number | undefined
    let rightPos: number | undefined
    if (rect.right - panelWidth < 8) {
      left = Math.max(8, rect.left)
    } else {
      rightPos = right
    }
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      ...(left !== undefined ? { left } : { right: rightPos }),
      zIndex: 9999,
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

  // Close panel on outside click or Escape
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
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowPanel(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [showPanel])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback for older browsers / insecure contexts
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripTitle ?? 'My Trip',
          text: 'Check out my trip itinerary!',
          url,
        })
      } catch {
        handleCopy()
      }
    } else {
      handleCopy()
    }
  }

  const panel = showPanel && mounted ? createPortal(
    <div
      ref={panelRef}
      className="w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 animate-in fade-in slide-in-from-top-2 duration-200"
      style={panelStyle}
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
    </div>,
    document.body
  ) : null

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
      {panel}
    </>
  )
}
