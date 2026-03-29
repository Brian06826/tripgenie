import type { DayPlan } from '@/lib/types'

export function TripSummaryCard({ days }: { days: DayPlan[] }) {
  const totalStops = days.reduce((sum, d) => sum + d.places.length, 0)
  const totalDays = days.length

  // Count restaurants for budget estimate
  const restaurants = days.flatMap(d => d.places.filter(p => p.type === 'restaurant'))
  const budgetParts: string[] = []

  // Estimate food budget from price ranges
  const priceMap: Record<string, number> = { '$': 15, '$$': 35, '$$$': 60, '$$$$': 100 }
  let totalFoodCost = 0
  let hasAnyPrice = false
  for (const r of restaurants) {
    const pr = r.priceRange?.replace(/[^$]/g, '')
    if (pr && priceMap[pr]) {
      totalFoodCost += priceMap[pr]
      hasAnyPrice = true
    } else {
      totalFoodCost += 30 // default estimate
    }
  }
  if (restaurants.length > 0) {
    budgetParts.push(`~$${totalFoodCost} food`)
  }

  // Calculate total travel time from travelFromPrevious
  let totalTravelMinutes = 0
  for (const day of days) {
    for (const place of day.places) {
      if (place.travelFromPrevious?.duration) {
        const dur = place.travelFromPrevious.duration
        const hourMatch = dur.match(/(\d+)\s*(?:hr|hour)/i)
        const minMatch = dur.match(/(\d+)\s*(?:min)/i)
        if (hourMatch) totalTravelMinutes += parseInt(hourMatch[1]) * 60
        if (minMatch) totalTravelMinutes += parseInt(minMatch[1])
      }
    }
  }

  // Cap displayed total at a reasonable maximum per day (3 hrs/day)
  const maxReasonableMinutes = days.length * 180
  const displayMinutes = Math.min(totalTravelMinutes, maxReasonableMinutes)
  const travelLabel = displayMinutes >= 60
    ? `${Math.floor(displayMinutes / 60)}h ${displayMinutes % 60}m`
    : `${displayMinutes}m`

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-navy">{totalDays}</p>
          <p className="text-xs text-gray-500">{totalDays === 1 ? 'Day' : 'Days'}</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-navy">{totalStops}</p>
          <p className="text-xs text-gray-500">Stops</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-navy">{restaurants.length}</p>
          <p className="text-xs text-gray-500">Restaurants</p>
        </div>
        {totalTravelMinutes > 0 ? (
          <div>
            <p className="text-2xl font-bold text-navy">{travelLabel}</p>
            <p className="text-xs text-gray-500">Travel</p>
          </div>
        ) : hasAnyPrice ? (
          <div>
            <p className="text-2xl font-bold text-navy">${totalFoodCost}</p>
            <p className="text-xs text-gray-500">Est. Food</p>
          </div>
        ) : (
          <div>
            <p className="text-2xl font-bold text-navy">{days.flatMap(d => d.places.filter(p => p.type === 'attraction')).length}</p>
            <p className="text-xs text-gray-500">Attractions</p>
          </div>
        )}
      </div>
    </div>
  )
}
