'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Trip } from '@/lib/types'
import { generateShareText } from '@/lib/export'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

function generateQrUrl(data: string, size: number): string {
  const encoded = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=8`
}

interface Props {
  tripId: string
  tripTitle?: string
  trip: Trip
}

export function ShareButton({ tripId, tripTitle, trip }: Props) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [url, setUrl] = useState(`/trip/${tripId}`)
  const [mounted, setMounted] = useState(false)
  const { locale } = useUILocale()
  const destination = tripTitle ?? 'My Trip'

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

  // Build share text: compact route-style format for messaging apps
  function getShareText(): string {
    return generateShareText(trip, url)
  }

  const [shareSuccess, setShareSuccess] = useState(false)

  async function handleShare() {
    // Mobile: try native share with formatted text
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: destination,
          text: getShareText(),
        })
        setShareSuccess(true)
        setTimeout(() => setShareSuccess(false), 2000)
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // Fall through to panel
      }
    }
    // Desktop or native share failed: show panel
    setShowPanel(true)
  }

  async function handleCopy() {
    let success = false
    try {
      await navigator.clipboard.writeText(url)
      success = true
    } catch {
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

  const shareMessage = getShareText()
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`
  const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(shareMessage)}`
  const smsUrl = `sms:?body=${encodeURIComponent(shareMessage)}`

  return (
    <>
      <button
        onClick={handleShare}
        aria-label="Share trip"
        className="flex items-center gap-2 bg-orange px-4 min-h-[44px] rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
      >
        📤 {t(locale, 'share.button')}
      </button>

      {/* Share success toast (after native share) */}
      {shareSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          {t(locale, 'share.shared')}
        </div>
      )}

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
            className="bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-80"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">
                {t(locale, 'share.title')}
              </h3>
              <button
                onClick={() => setShowPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Social share buttons */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 group"
                aria-label="Share on WhatsApp"
              >
                <span className="w-12 h-12 flex items-center justify-center rounded-full bg-[#25D366]/10 text-xl group-hover:bg-[#25D366]/20 transition-colors">
                  💬
                </span>
                <span className="text-[10px] text-gray-500">WhatsApp</span>
              </a>
              <a
                href={lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 group"
                aria-label="Share on LINE"
              >
                <span className="w-12 h-12 flex items-center justify-center rounded-full bg-[#00B900]/10 text-xl group-hover:bg-[#00B900]/20 transition-colors">
                  🟢
                </span>
                <span className="text-[10px] text-gray-500">LINE</span>
              </a>
              <a
                href={smsUrl}
                className="flex flex-col items-center gap-1 group"
                aria-label="Share via SMS"
              >
                <span className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-50 text-xl group-hover:bg-blue-100 transition-colors">
                  💬
                </span>
                <span className="text-[10px] text-gray-500">SMS</span>
              </a>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center mb-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">
                {t(locale, 'share.qr')}
              </p>
              <img
                src={generateQrUrl(url, 140)}
                alt="QR code for trip"
                width={140}
                height={140}
                className="rounded-lg border border-gray-100"
              />
            </div>

            {/* URL display */}
            <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-xs text-gray-500 font-mono truncate">
              {url}
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] ${
                copyFailed
                  ? 'bg-red-50 text-red-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {copied
                ? t(locale, 'share.linkCopied')
                : copyFailed
                  ? t(locale, 'share.copyFailed')
                  : t(locale, 'share.copyLink')
              }
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
