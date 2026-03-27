import type { DayPlan } from '@/lib/types'
import { PlaceCard } from './PlaceCard'

export function DayCard({ day }: { day: DayPlan }) {
  return (
    <section className="mb-6">
      <div className="sticky top-0 bg-navy text-white px-4 py-2 rounded-lg mb-3 z-10">
        <h2 className="font-bold text-sm">Day {day.dayNumber}</h2>
        <p className="text-xs opacity-80">{day.title}</p>
      </div>
      {day.places.map((place, i) => (
        <PlaceCard key={i} place={place} />
      ))}
    </section>
  )
}
