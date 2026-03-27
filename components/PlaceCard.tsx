import type { Place } from '@/lib/types'

const TYPE_ICONS: Record<Place['type'], string> = {
  attraction: '🎡',
  restaurant: '🍽️',
  hotel: '🏨',
  transport: '🚗',
  other: '📍',
}

export function PlaceCard({ place }: { place: Place }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3">
      {/* Time + type */}
      {place.arrivalTime && (
        <div className="text-xs font-semibold text-orange mb-1">
          {TYPE_ICONS[place.type]} {place.arrivalTime}
          {place.duration && ` · ${place.duration}`}
          {place.priceRange && ` · ${place.priceRange}`}
        </div>
      )}

      {/* Name */}
      <h3 className="font-bold text-gray-900 text-base mb-0.5">{place.name}</h3>
      {place.nameLocal && (
        <p className="text-sm text-gray-500 mb-2">{place.nameLocal}</p>
      )}

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed mb-3">{place.description}</p>

      {/* Ratings */}
      {(place.googleRating || place.yelpRating) && (
        <div className="flex gap-2 mb-2">
          {place.googleRating && (
            <span className="text-xs border border-blue-200 text-blue-600 px-2 py-0.5 rounded-md">
              ⭐ Google {place.googleRating.toFixed(1)}
              {place.googleReviewCount && ` · ${place.googleReviewCount.toLocaleString()}+`}
            </span>
          )}
          {place.yelpRating && (
            <span className="text-xs border border-red-200 text-red-500 px-2 py-0.5 rounded-md">
              ⭐ Yelp {place.yelpRating.toFixed(1)}
              {place.yelpReviewCount && ` · ${place.yelpReviewCount.toLocaleString()}+`}
            </span>
          )}
        </div>
      )}

      {/* Parking */}
      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1.5 rounded-md mb-3">
        🅿️ {place.parking.details}
        {place.parking.tips && ` · ${place.parking.tips}`}
      </div>

      {/* Tips */}
      {place.tips && (
        <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-md mb-3">
          💡 {place.tips}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <a
          href={place.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${place.name} on Google Maps`}
          className="flex-1 text-center text-xs font-semibold bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          📍 Google Maps
        </a>
        <a
          href={place.yelpUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${place.name} on Yelp`}
          className="flex-1 text-center text-xs font-semibold bg-red-50 text-red-500 py-2 rounded-lg hover:bg-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          🔥 Yelp
        </a>
      </div>

      {/* Backup restaurants */}
      {place.backupOptions && place.backupOptions.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
            🔄 備選餐廳 ({place.backupOptions.length})
          </summary>
          <div className="mt-2 space-y-2">
            {place.backupOptions.map((backup, i) => (
              <div key={i} className="text-xs border border-gray-100 rounded-lg p-2">
                <div className="font-semibold text-gray-700">{backup.name}</div>
                {backup.nameLocal && <div className="text-gray-400">{backup.nameLocal}</div>}
                <div className="text-gray-500 mt-0.5">{backup.description}</div>
                {(backup.yelpRating || backup.googleRating) && (
                  <div className="flex gap-2 mt-1">
                    {backup.googleRating && (
                      <span className="text-blue-500">⭐ G {backup.googleRating.toFixed(1)}</span>
                    )}
                    {backup.yelpRating && (
                      <span className="text-red-400">⭐ Y {backup.yelpRating.toFixed(1)}</span>
                    )}
                  </div>
                )}
                <div className="flex gap-2 mt-1.5">
                  <a href={backup.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                     className="text-blue-500 underline">Maps</a>
                  <a href={backup.yelpUrl} target="_blank" rel="noopener noreferrer"
                     className="text-red-400 underline">Yelp</a>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
