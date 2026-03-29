import type { Place } from '@/lib/types'

const TYPE_ICONS: Record<Place['type'], string> = {
  attraction: '🎡',
  restaurant: '🍽️',
  hotel: '🏨',
  transport: '🚗',
  other: '📍',
}

type VerifyStatus = 'pending' | 'verified' | 'none'

export function PlaceCard({ place, verifyStatus = 'none' }: { place: Place; verifyStatus?: VerifyStatus }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3 transition-all duration-300">
      {/* Time + type */}
      {place.arrivalTime && (
        <div className="text-xs font-semibold text-orange mb-1">
          {TYPE_ICONS[place.type]} {place.arrivalTime}
          {place.duration && ` · ${place.duration}`}
          {place.priceRange && ` · ${place.priceRange}`}
        </div>
      )}

      {/* Name + verification badge */}
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
      </div>
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
        <a
          href={place.yelpUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Search Yelp for ${place.name}`}
          className="flex-1 flex items-center justify-center text-xs font-semibold bg-red-50 text-red-500 min-h-[44px] rounded-lg hover:bg-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Yelp
        </a>
      </div>
    </div>
  )
}
