'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

function generateQrUrl(data: string, size: number): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8`
}

export function ShareButton({ tripId, tripTitle }: { tripId: string; tripTitle?: string }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [url, setUrl] = useState(`/trip/${tripId}`)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setUrl(`${window.location.origin}/trip/${tripId}`)
  }, [tripId])

  // Close on Escape key
  useEffect(() => {
    if (!showPanel) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowPanel(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showPanel])

  async function handleCopy() {
    let success = false
    try {
      await navigator.clipboard.writeText(url)
      success = true
    } catch {
      // Fallback for non-HTTPS or permission denied
      try {
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        success = document.execCommand('copy')
        document.body.removeChild(textarea)
      } catch {
        success = false
      }
    }

    if (success) {
      setCopied(true)
      setCopyFailed(false)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 3000)
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripTitle ?? 'My Trip',
          text: 'Check out my trip itinerary!',
          url,
        })
        setShowPanel(false)
        return
      } catch (err) {
        // AbortError = user cancelled the share sheet — do nothing, stay on panel
        if (err instanceof Error && err.name === 'AbortError') return
        // Any other error (NotAllowedError, TypeError) — fall through to copy
      }
    }
    // Fallback: copy to clipboard
    handleCopy()
  }

  return (
    <>
      <button
        onClick={() => setShowPanel(true)}
        aria-label="Share trip"
        className="flex items-center gap-2 bg-orange px-4 min-h-[44px] rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
      >
        📤 Share
      </button>

      {showPanel && mounted && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onClick={() => setShowPanel(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-72"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Share Trip / 分享行程</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center mb-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">Scan to view / 掃碼查看</p>
              <img
                src={generateQrUrl(url, 160)}
                alt="QR code for trip"
                width={160}
                height={160}
                className="rounded-lg border border-gray-100"
              />
            </div>

            {/* URL display */}
            <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-xs text-gray-500 font-mono truncate">
              {url}
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={handleCopy}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
                  copyFailed
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {copied ? '✅ Copied!' : copyFailed ? '⚠️ Copy failed — try long-press the link above' : '📋 Copy Link / 複製連結'}
              </button>
              {mounted && 'share' in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-2.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors min-h-[44px]"
                >
                  📱 Share via App / 分享到應用
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
