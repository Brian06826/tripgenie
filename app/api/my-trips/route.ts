import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserTripIds, getTrip } from '@/lib/storage'

export async function GET() {
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = (session?.user as any)?.id as string | undefined

  if (!userId) {
    return Response.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const tripIds = await getUserTripIds(userId)
  if (tripIds.length === 0) {
    return Response.json({ trips: [] })
  }

  // Fetch trip metadata in parallel (cap at 20 for speed)
  const ids = tripIds.slice(0, 20)
  const trips = await Promise.all(
    ids.map(async (id) => {
      const trip = await getTrip(id)
      if (!trip) return null
      return {
        id: trip.id,
        title: trip.title,
        destination: trip.destination,
        days: Math.max(...trip.days.map(d => d.dayNumber)),
        language: trip.language,
        createdAt: trip.createdAt,
        heroImageUrl: trip.heroImageUrl,
      }
    })
  )

  return Response.json({
    trips: trips.filter(Boolean),
  })
}
