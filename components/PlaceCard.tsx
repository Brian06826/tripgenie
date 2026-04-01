'use client'

import { useState, useRef } from 'react'
import type { Place } from '@/lib/types'

const TYPE_ICONS: Record<Place['type'], string> = {
  attraction: '🎡',
  restaurant: '🍽️',
  hotel: '🏨',
  transport: '🚗',
  other: '📍',
}

type VerifyStatus = 'pending' | 'verified' | 'none'

export function PlaceCard({
  place,
  verifyStatus = 'none',
  showYelp = true,
  onEdit,
  onRemove,
  onTimeChange,
  editLoading = false,
  removeLoading = false,
}: {
  place: Place
  verifyStatus?: VerifyStatus
  showYelp?: boolean
  onEdit?: (instruction: string) => void
  onRemove?: () => void
  onTimeChange?: (newTime: string) => void
  editLoading?: boolean
  removeLoading?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editingTime, setEditingTime] = useState(false)
  const [timeText, setTimeText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  function handleSubmitEdit() {
    const instruction = editText.trim()
    if (!instruction || !onEdit) return
    onEdit(instruction)
    setEditText('')
    setEditing(false)
  }

  function handleTimeSubmit() {
    const val = timeText.trim()
    setEditingTime(false)
    if (!val || !onTimeChange) return
    // Accept formats: "2:00 PM", "14:00", "2pm", "2:30pm", "14:30"
    const match12 = val.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/i)
    if (match12) {
      const h = parseInt(match12[1])
      const m = match12[2] || '00'
      const p = match12[3].toUpperCase()
      onTimeChange(`${h}:${m.padStart(2, '0')} ${p}`)
      return
    }
    const match24 = val.match(/^(\d{1,2}):(\d{2})$/)
    if (match24) {
      const h = parseInt(match24[1])
      const m = match24[2]
      // Convert to 12h if original was 12h format
      const was12h = place.arrivalTime?.includes('AM') || place.arrivalTime?.includes('PM')
      if (was12h) {
        const period = h >= 12 ? 'PM' : 'AM'
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        onTimeChange(`${h12}:${m} ${period}`)
      } else {
        onTimeChange(val)
      }
      return
    }
    // Invalid format — ignore
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3 transition-all duration-300">
      {/* Time + type */}
      {place.arrivalTime && (
        <div className="text-xs font-semibold text-orange mb-1">
          {TYPE_ICONS[place.type]}{' '}
          {editingTime && onTimeChange ? (
            <input
              ref={timeInputRef}
              type="text"
              inputMode="numeric"
              value={timeText}
              onChange={(e) => setTimeText(e.target.value)}
              onBlur={handleTimeSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTimeSubmit(); if (e.key === 'Escape') setEditingTime(false) }}
              placeholder="e.g. 2:00 PM"
              autoComplete="off"
              className="inline-block w-24 text-xs font-semibold text-orange bg-orange/5 border border-orange/30 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { if (onTimeChange) { setTimeText(place.arrivalTime || ''); setEditingTime(true); setTimeout(() => timeInputRef.current?.focus(), 50) } }}
              className={onTimeChange ? 'border-b border-dotted border-orange/40 hover:border-orange cursor-pointer transition-colors' : ''}
              disabled={!onTimeChange}
              type="button"
            >
              {place.arrivalTime}
            </button>
          )}
          {place.duration && ` · ${place.duration}`}
          {place.priceRange && ` · ${place.priceRange}`}
        </div>
      )}

      {/* Name + verification badge + edit button */}
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="font-bold text-gray-900 text-base">{place.name}</h3>
        {verifyStatus === 'pending' && (
          <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full animate-pulse">
            ⏳ Verifying...
          </span>
        )}
        {verifyStatus === 'verified' && (
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            ✓ Verified
          </span>
        )}
        {(onEdit || onRemove) && !editLoading && !removeLoading && (
          <div className="ml-auto flex items-center gap-1">
            {onEdit && (
              <button
                onClick={() => {
                  setEditing(!editing)
                  setTimeout(() => inputRef.current?.focus(), 50)
                }}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                aria-label={`Edit ${place.name}`}
              >
                ✏️
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold"
                aria-label={`Remove ${place.name}`}
              >
                ✕
              </button>
            )}
          </div>
        )}
        {(editLoading || removeLoading) && (
          <span className="ml-auto text-[10px] text-orange bg-orange/10 px-2 py-1 rounded-full animate-pulse">
            {removeLoading ? 'Removing...' : 'Updating...'}
          </span>
        )}
      </div>
      {place.nameLocal && (
        <p className="text-sm text-gray-500 mb-2">{place.nameLocal}</p>
      )}

      {/* Inline edit input */}
      {editing && onEdit && (
        <div className="flex gap-2 mb-3">
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitEdit(); if (e.key === 'Escape') setEditing(false) }}
            placeholder="e.g. change to Japanese, make cheaper, remove..."
            autoComplete="off"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
          />
          <button
            onClick={handleSubmitEdit}
            disabled={!editText.trim()}
            className="shrink-0 px-3 py-2 bg-orange text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Go
          </button>
        </div>
      )}

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed mb-3">{place.description}</p>

      {/* Ratings */}
      {(place.googleRating || place.yelpRating) && (
        <div className="flex gap-2 mb-2">
          {place.googleRating && (
            <span className="text-xs border border-blue-200 text-blue-600 px-2 py-0.5 rounded-md">
              Google {place.googleRating.toFixed(1)}
              {place.googleReviewCount && ` · ${place.googleReviewCount.toLocaleString()}+`}
            </span>
          )}
          {place.yelpRating && (
            <span className="text-xs border border-red-200 text-red-500 px-2 py-0.5 rounded-md">
              Yelp {place.yelpRating.toFixed(1)}
              {place.yelpReviewCount && ` · ${place.yelpReviewCount.toLocaleString()}+`}
            </span>
          )}
        </div>
      )}

      {/* Parking */}
      {place.parking && (
        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1.5 rounded-md mb-3">
          <span className="font-semibold text-gray-600">Parking</span> {place.parking.details}
          {place.parking.tips && ` · ${place.parking.tips}`}
        </div>
      )}

      {/* Tips */}
      {place.tips && (
        <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-md mb-3">
          <span className="font-semibold">Tip</span> {place.tips}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <a
          href={place.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${place.name} on Google Maps`}
          className="flex-1 flex items-center justify-center text-xs font-semibold bg-blue-50 text-blue-600 min-h-[44px] rounded-lg hover:bg-blue-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Maps
        </a>
        <a
          href={place.googleReviewsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Search Google Reviews for ${place.name}`}
          className="flex-1 flex items-center justify-center text-xs font-semibold bg-blue-50 text-blue-600 min-h-[44px] rounded-lg hover:bg-blue-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Reviews
        </a>
        {showYelp && (
          <a
            href={place.yelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Search Yelp for ${place.name}`}
            className="flex-1 flex items-center justify-center text-xs font-semibold bg-red-50 text-red-500 min-h-[44px] rounded-lg hover:bg-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Yelp
          </a>
        )}
        {place.type === 'hotel' && place.bookingUrl && (
          <a
            href={place.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open booking for ${place.name}`}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold bg-orange/10 text-orange min-h-[44px] rounded-lg hover:bg-orange/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
          >
            Book
          </a>
        )}
      </div>
    </div>
  )
}
