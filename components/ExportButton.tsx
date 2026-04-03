'use client'

import { useState, useRef, useEffect } from 'react'
import type { Trip } from '@/lib/types'
import { downloadICS, generatePlainText, copyToClipboard, buildGoogleMapsRouteUrl, openPrintView, downloadTripImage } from '@/lib/export'

interface Props {
  trip: Trip
}

export function ExportButton({ trip }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mapsOpen, setMapsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const cn = trip.language === 'zh-TW' || trip.language === 'zh-HK' || trip.language === 'zh-CN'

  // Close dropdown on outside click
  useEffect(() => {
    if (!open && !mapsOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setMapsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, mapsOpen])

  // Close on Escape
  useEffect(() => {
    if (!open && !mapsOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setMapsOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, mapsOpen])

  function handleCalendar() {
    downloadICS(trip)
    setOpen(false)
  }

  async function handleCopyText() {
    const text = generatePlainText(trip)
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setOpen(false)
  }

  function handlePDF() {
    openPrintView(trip)
    setOpen(false)
  }

  function handleImage() {
    downloadTripImage(trip)
    setOpen(false)
  }

  function handleMaps() {
    setOpen(false)
    if (trip.days.length === 1) {
      // Single day — open directly
      const url = buildGoogleMapsRouteUrl(trip.days[0])
      if (url) window.open(url, '_blank')
    } else {
      // Multiple days — show day picker
      setMapsOpen(true)
    }
  }

  function handleDayRoute(dayIndex: number) {
    const url = buildGoogleMapsRouteUrl(trip.days[dayIndex])
    if (url) window.open(url, '_blank')
    setMapsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setOpen(!open); setMapsOpen(false) }}
        className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 min-h-[44px] rounded-lg text-white text-sm font-semibold transition-opacity hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
        aria-label={cn ? '匯出行程' : 'Export trip'}
      >
        📥 {cn ? '匯出' : 'Export'}
      </button>

      {/* Export format dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
          <button
            onClick={handleCalendar}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg">📅</span>
            <div>
              <div className="font-medium">{cn ? '加入日曆' : 'Add to Calendar'}</div>
              <div className="text-xs text-gray-400">{cn ? '下載 .ics 檔案' : 'Download .ics file'}</div>
            </div>
          </button>

          <button
            onClick={handleCopyText}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <span className="text-lg">📋</span>
            <div>
              <div className="font-medium">
                {copied
                  ? (cn ? '✅ 已複製！' : '✅ Copied!')
                  : (cn ? '複製文字' : 'Copy as Text')
                }
              </div>
              <div className="text-xs text-gray-400">{cn ? '分享去 WhatsApp / LINE' : 'Share to WhatsApp / LINE'}</div>
            </div>
          </button>

          <button
            onClick={handlePDF}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <span className="text-lg">📄</span>
            <div>
              <div className="font-medium">{cn ? '下載 PDF' : 'Download PDF'}</div>
              <div className="text-xs text-gray-400">{cn ? '靚嘅 A4 行程表' : 'Styled A4 itinerary'}</div>
            </div>
          </button>

          <button
            onClick={handleImage}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <span className="text-lg">🖼️</span>
            <div>
              <div className="font-medium">{cn ? '下載圖片' : 'Download Image'}</div>
              <div className="text-xs text-gray-400">{cn ? '適合 IG Story / 小紅書' : 'For IG Story / social media'}</div>
            </div>
          </button>

          <button
            onClick={handleMaps}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <span className="text-lg">🗺️</span>
            <div>
              <div className="font-medium">{cn ? 'Google Maps 路線' : 'Google Maps Route'}</div>
              <div className="text-xs text-gray-400">{cn ? '開 Google Maps 導航' : 'Open route in Maps'}</div>
            </div>
          </button>
        </div>
      )}

      {/* Day picker for Maps (multi-day trips) */}
      {mapsOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
            {cn ? '選擇日期' : 'Select Day'}
          </div>
          {trip.days.map((day, i) => (
            <button
              key={day.dayNumber}
              onClick={() => handleDayRoute(i)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100 first:border-t-0"
            >
              <span className="text-lg">📍</span>
              <div>
                <div className="font-medium">
                  {cn ? `第${day.dayNumber}日` : `Day ${day.dayNumber}`}
                </div>
                <div className="text-xs text-gray-400 truncate">{day.title}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
