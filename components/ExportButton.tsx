'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Trip } from '@/lib/types'
import { downloadICS, generatePlainText, copyToClipboard, buildGoogleMapsRouteUrl, downloadTripImage } from '@/lib/export'
import { useUILocale } from '@/lib/i18n-context'
import { t } from '@/lib/i18n'

interface Props {
  trip: Trip
}

export function ExportButton({ trip }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mapsOpen, setMapsOpen] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'calendar' | 'image' | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { locale } = useUILocale()

  useEffect(() => { setMounted(true) }, [])

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
    if (!open && !mapsOpen && !datePickerOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setMapsOpen(false)
        setDatePickerOpen(false)
        setPendingAction(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, mapsOpen, datePickerOpen])

  function runExport(action: 'calendar' | 'image', startDate?: string) {
    const tripWithDate: Trip = startDate
      ? { ...trip, startDate }
      : trip
    if (action === 'calendar') {
      downloadICS(tripWithDate)
    } else {
      downloadTripImage(tripWithDate)
    }
  }

  function handleCalendar() {
    setOpen(false)
    if (trip.startDate) {
      downloadICS(trip)
    } else {
      setPendingAction('calendar')
      setSelectedDate(new Date().toISOString().slice(0, 10))
      setDatePickerOpen(true)
    }
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

  function handleImage() {
    setOpen(false)
    if (trip.startDate) {
      downloadTripImage(trip)
    } else {
      setPendingAction('image')
      setSelectedDate(new Date().toISOString().slice(0, 10))
      setDatePickerOpen(true)
    }
  }

  function handleDateConfirm() {
    if (pendingAction) {
      runExport(pendingAction, selectedDate || undefined)
    }
    setDatePickerOpen(false)
    setPendingAction(null)
  }

  function handleDateSkip() {
    if (pendingAction) {
      runExport(pendingAction)
    }
    setDatePickerOpen(false)
    setPendingAction(null)
  }

  function handleMaps() {
    setOpen(false)
    if (trip.days.length === 1) {
      const url = buildGoogleMapsRouteUrl(trip.days[0])
      if (url) window.open(url, '_blank')
    } else {
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
        aria-label={t(locale, 'export.ariaLabel')}
      >
        📥 {t(locale, 'export.button')}
      </button>

      {/* Export format dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
          <button
            onClick={handleCopyText}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg">📋</span>
            <div>
              <div className="font-medium">
                {copied ? t(locale, 'export.copied') : t(locale, 'export.copyText')}
              </div>
              <div className="text-xs text-gray-400">{t(locale, 'export.copyDesc')}</div>
            </div>
          </button>

          <button
            onClick={handleImage}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <span className="text-lg">📸</span>
            <div>
              <div className="font-medium">{t(locale, 'export.downloadImage')}</div>
              <div className="text-xs text-gray-400">{t(locale, 'export.imageDesc')}</div>
            </div>
          </button>

          <button
            onClick={handleMaps}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <span className="text-lg">🗺️</span>
            <div>
              <div className="font-medium">{t(locale, 'export.mapsRoute')}</div>
              <div className="text-xs text-gray-400">{t(locale, 'export.mapsDesc')}</div>
            </div>
          </button>

          <button
            onClick={handleCalendar}
            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
          >
            <span className="text-lg">📅</span>
            <div>
              <div className="font-medium">{t(locale, 'export.calendar')}</div>
              <div className="text-xs text-gray-400">{t(locale, 'export.calendarDesc')}</div>
            </div>
          </button>
        </div>
      )}

      {/* Day picker for Maps (multi-day trips) */}
      {mapsOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
            {t(locale, 'export.selectDay')}
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
                  {t(locale, 'export.dayN', { n: day.dayNumber })}
                </div>
                <div className="text-xs text-gray-400 truncate">{day.title}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Date picker modal — portaled to body to avoid z-index/overflow issues */}
      {mounted && datePickerOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setDatePickerOpen(false); setPendingAction(null) } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-[320px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-base font-bold text-gray-800">
                {t(locale, 'export.selectDate')}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {pendingAction === 'calendar'
                  ? t(locale, 'export.calendarDateHint')
                  : t(locale, 'export.imageDateHint')
                }
              </p>
            </div>
            <div className="px-6 py-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
              />
            </div>
            <div className="px-6 pb-5 pt-2 flex gap-3">
              <button
                onClick={handleDateSkip}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors min-h-[44px]"
              >
                {t(locale, 'export.skip')}
              </button>
              <button
                onClick={handleDateConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange hover:opacity-90 transition-opacity min-h-[44px]"
              >
                {t(locale, 'export.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
