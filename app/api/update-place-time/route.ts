import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { saveTrip, getTrip } from '@/lib/storage'

export async function POST(request: Request) {
  try {
    const { tripId, dayNumber, placeIndex, newTime } = await request.json()

    if (!tripId || typeof tripId !== 'string') {
      return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })
    }
    if (typeof dayNumber !== 'number' || typeof placeIndex !== 'number') {
      return NextResponse.json({ error: 'Missing dayNumber or placeIndex' }, { status: 400 })
    }
    if (!newTime || typeof newTime !== 'string') {
      return NextResponse.json({ error: 'Missing newTime' }, { status: 400 })
    }

    const trip = await getTrip(tripId)
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    const dayIndex = trip.days.findIndex(d => d.dayNumber === dayNumber)
    if (dayIndex === -1) {
      return NextResponse.json({ error: 'Day not found' }, { status: 400 })
    }

    const day = trip.days[dayIndex]
    if (placeIndex < 0 || placeIndex >= day.places.length) {
      return NextResponse.json({ error: 'Place not found' }, { status: 400 })
    }

    // Update the arrival time
    const updatedDays = trip.days.map((d, di) => {
      if (di !== dayIndex) return d
      return {
        ...d,
        places: d.places.map((p, pi) => {
          if (pi !== placeIndex) return p
          return { ...p, arrivalTime: newTime }
        }),
      }
    })

    const updatedTrip = { ...trip, days: updatedDays }
    await saveTrip(tripId, updatedTrip)
    revalidatePath(`/trip/${tripId}`)

    return NextResponse.json({ success: true, trip: updatedTrip })
  } catch (err) {
    console.error('[update-place-time] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update time' },
      { status: 500 },
    )
  }
}
