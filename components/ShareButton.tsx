'use client'
import { useState, useRef, useEffect } from 'react'

function generateQrUrl(data: string, size: number): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8`
}

export function ShareButton({ tripId, tripTitle }: { tripId: string; tripTitle?: string }) {
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState(`/trip/${tripId}`)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Set full URL on client only (avoid SSR hydration mismatch)
  useEffect(() => {
    setUrl(`${window.location.origin}/trip/${tripId}`)
  }, [tripId])

  function openPanel() {
    dialogRef.current?.showModal()
  }

  function closePanel() {
    dialogRef.current?.close()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
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
        closePanel()
      } catch {
        // User cancelled — stay on panel
      }
    } else {
      handleCopy()
    }
  }

  return (
    <>
      <button
        onClick={openPanel}
        aria-label="Share trip"
        className="flex items-center gap-2 bg-orange px-4 min-h-[44px] rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
      >
        📤 Share
      </button>

      {/* Native <dialog> renders in the browser's top layer — above ALL CSS stacking contexts */}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          // Close when clicking the backdrop (outside the inner card)
          if (e.target === dialogRef.current) closePanel()
        }}
        className="backdrop:bg-black/40 bg-transparent p-0 m-auto rounded-xl outline-none max-w-xs w-full open:flex open:flex-col open:items-center"
      >
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-72">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Share Trip / 分享行程</h3>
            <button
              onClick={closePanel}
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
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors min-h-[44px]"
            >
              {copied ? '✅ Copied!' : '📋 Copy Link / 複製連結'}
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-2.5 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors min-h-[44px]"
              >
                📱 Share via App / 分享到應用
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
