'use client'

import { useEffect, useRef, useState } from 'react'
import type { DayPlan } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  attraction: '#3b82f6',  // blue
  restaurant: '#f97316',  // orange
  hotel: '#8b5cf6',       // purple
  transport: '#6b7280',   // gray
  other: '#10b981',       // green
}

const DAY_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#eab308', '#06b6d4', '#ec4899', '#14b8a6', '#f59e0b',
]

interface Props {
  days: DayPlan[]
  onSelectPlace?: (dayIndex: number, placeIndex: number) => void
}

export function TripMap({ days, onSelectPlace }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  // Default open on desktop (>=768px), closed on mobile
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 768
  })
  const [activeDay, setActiveDay] = useState<number | null>(null)

  // Collect all places with coordinates
  const allPlaces = days.flatMap((day, di) =>
    day.places
      .map((p, pi) => ({ ...p, dayIndex: di, placeIndex: pi }))
      .filter(p => p.lat != null && p.lng != null)
  )

  const hasCoords = allPlaces.length > 0

  useEffect(() => {
    if (!isOpen || !hasCoords || !mapRef.current) return

    // Destroy stale map instance from previous open/close cycle
    if (leafletMap.current) {
      try { leafletMap.current.remove() } catch {}
      leafletMap.current = null
    }

    let cancelled = false

    async function initMap() {
      const L = (await import('leaflet')).default

      // Fix default marker icons (Leaflet webpack issue)
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (cancelled || !mapRef.current) return

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      leafletMap.current = map

      renderMarkers(L, map, null)
    }

    initMap()
    return () => { cancelled = true }
  }, [isOpen, hasCoords])

  // Re-render markers when activeDay changes
  useEffect(() => {
    if (!leafletMap.current || !isOpen) return

    async function update() {
      const L = (await import('leaflet')).default
      renderMarkers(L, leafletMap.current, activeDay)
    }
    update()
  }, [activeDay, isOpen])

  function renderMarkers(L: any, map: any, filterDay: number | null) {
    // Clear existing markers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer)
      }
    })

    const filtered = filterDay != null
      ? allPlaces.filter(p => p.dayIndex === filterDay)
      : allPlaces

    if (filtered.length === 0) return

    const bounds: [number, number][] = []

    // Group by day for polylines
    const dayGroups = new Map<number, typeof filtered>()
    for (const p of filtered) {
      const arr = dayGroups.get(p.dayIndex) ?? []
      arr.push(p)
      dayGroups.set(p.dayIndex, arr)
    }

    // Draw route lines per day
    for (const [di, places] of dayGroups) {
      const coords = places.map(p => [p.lat!, p.lng!] as [number, number])
      if (coords.length > 1) {
        L.polyline(coords, {
          color: DAY_COLORS[di % DAY_COLORS.length],
          weight: 2.5,
          opacity: 0.5,
          dashArray: '6 8',
        }).addTo(map)
      }
    }

    // Add numbered markers
    for (const place of filtered) {
      const color = TYPE_COLORS[place.type] ?? TYPE_COLORS.other
      const dayColor = DAY_COLORS[place.dayIndex % DAY_COLORS.length]
      const num = place.placeIndex + 1

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background: ${filterDay != null ? color : dayColor};
          color: white;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${num}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })

      const marker = L.marker([place.lat!, place.lng!], { icon }).addTo(map)
      bounds.push([place.lat!, place.lng!])

      const popup = `
        <div style="min-width: 150px">
          <strong style="font-size: 13px">${place.name}</strong>
          ${place.nameLocal ? `<br><span style="color: #888; font-size: 11px">${place.nameLocal}</span>` : ''}
          <br><span style="font-size: 11px; color: #666">Day ${place.dayIndex + 1} · ${place.arrivalTime ?? ''}</span>
          ${place.googleRating ? `<br><span style="font-size: 11px; color: #2563eb">Google ${place.googleRating.toFixed(1)}</span>` : ''}
        </div>
      `
      marker.bindPopup(popup)
      marker.on('click', () => {
        onSelectPlace?.(place.dayIndex, place.placeIndex)
      })
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }

  if (!hasCoords) return null

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:border-orange hover:text-orange transition-colors mb-4 min-h-[44px]"
      >
        {isOpen ? '📋 Hide Map / 隱藏地圖' : '🗺️ Show Map / 顯示地圖'}
      </button>

      {isOpen && (
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          {/* Day filter tabs */}
          {days.length > 1 && (
            <div className="bg-white px-3 py-2 flex gap-1.5 overflow-x-auto border-b border-gray-100">
              <button
                onClick={() => setActiveDay(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeDay === null
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {days.map((day, i) => (
                <button
                  key={day.dayNumber}
                  onClick={() => setActiveDay(i)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    activeDay === i
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  style={activeDay === i ? { background: DAY_COLORS[i % DAY_COLORS.length] } : undefined}
                >
                  Day {day.dayNumber}
                </button>
              ))}
            </div>
          )}

          {/* Leaflet CSS loaded via link tag */}
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />
          <div ref={mapRef} style={{ height: 360, width: '100%' }} />
        </div>
      )}
    </>
  )
}
