'use client'

// Mini preview of what a generated itinerary looks like — builds trust for new users
const PREVIEW_PLACES = [
  {
    time: '10:00 AM',
    duration: '2 hours',
    name: 'Senso-ji Temple',
    nameLocal: '浅草寺',
    type: 'attraction' as const,
    rating: 4.6,
    reviews: 48200,
    description: 'Tokyo\'s oldest and most visited temple. Walk through the iconic Kaminarimon gate.',
  },
  {
    time: '12:30 PM',
    duration: '1 hour',
    name: 'Ichiran Ramen Asakusa',
    nameLocal: '一蘭拉麵 浅草店',
    type: 'restaurant' as const,
    rating: 4.4,
    reviews: 5100,
    description: 'Famous tonkotsu ramen chain with private booths. Customize your noodle firmness and spice.',
  },
  {
    time: '3:00 PM',
    duration: '2-3 hours',
    name: 'teamLab Borderless',
    nameLocal: 'チームラボボーダレス',
    type: 'attraction' as const,
    rating: 4.5,
    reviews: 12400,
    description: 'Immersive digital art museum. Wander through projection-mapped rooms.',
  },
]

const TYPE_ICONS: Record<string, string> = {
  attraction: '🎡',
  restaurant: '🍽️',
}

const FEATURE_LABELS = [
  { emoji: '✏️', text: 'Edit any place', textZh: '可編輯任何景點' },
  { emoji: '🔄', text: 'Swap alternatives', textZh: '一鍵替換備選' },
  { emoji: '🗺️', text: 'See on map', textZh: '地圖查看' },
]

export function ProductPreview({ isZh = false }: { isZh?: boolean }) {
  return (
    <section className="max-w-xl lg:max-w-3xl mx-auto px-4 py-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {isZh ? '行程預覽' : 'What You Get'}
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        {isZh ? '每個行程都有詳細資料、評分、地圖連結' : 'Detailed info, ratings, and map links for every stop'}
      </p>

      {/* Feature labels */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FEATURE_LABELS.map(f => (
          <span
            key={f.text}
            className="text-[10px] font-medium bg-orange/10 text-orange px-2.5 py-1 rounded-full"
          >
            {f.emoji} {isZh ? f.textZh : f.text}
          </span>
        ))}
      </div>

      {/* Mini place cards */}
      <div className="space-y-2.5">
        {PREVIEW_PLACES.map((place, i) => (
          <div
            key={place.name}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-3.5 transition-transform"
            style={{
              transform: i === 1 ? 'translateX(8px)' : i === 2 ? 'translateX(4px)' : undefined,
            }}
          >
            {/* Time + type */}
            <div className="text-[11px] font-semibold text-orange mb-1">
              {TYPE_ICONS[place.type]} {place.time} · {place.duration}
            </div>

            {/* Name + badge */}
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-gray-900 text-sm">{place.name}</h3>
              {place.type === 'restaurant' && (
                <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  ✓ Verified
                </span>
              )}
            </div>
            {place.nameLocal && (
              <p className="text-xs text-gray-400 mb-1.5">{place.nameLocal}</p>
            )}

            {/* Description */}
            <p className="text-xs text-gray-500 leading-relaxed mb-2">{place.description}</p>

            {/* Rating + action buttons */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] border border-blue-200 text-blue-600 px-1.5 py-0.5 rounded-md">
                Google {place.rating.toFixed(1)} · {(place.reviews / 1000).toFixed(1)}k+
              </span>
              <div className="ml-auto flex gap-1.5">
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded-md">
                  Maps
                </span>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded-md">
                  Reviews
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fade-out hint */}
      <div className="h-6 bg-gradient-to-b from-transparent to-gray-50 -mt-4 relative z-10 rounded-b-xl" />
      <p className="text-center text-xs text-gray-400 -mt-1">
        {isZh ? '⬆️ 真實行程範例 — 你嘅行程亦會咁樣' : '⬆️ Real itinerary preview — yours will look like this'}
      </p>
    </section>
  )
}
