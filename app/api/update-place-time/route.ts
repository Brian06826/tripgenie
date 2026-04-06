import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { saveTrip, getTrip } from '@/lib/storage'
import { isRateLimited, rateLimitResponse } from '@/lib/rate-limit'

function parseTimeToMinutes(timeStr: string): number | null {
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12) {
    let h = parseInt(match12[1])
    const m = parseInt(match12[2])
    const period = match12[3].toUpperCase()
    if (period === 'PM' && h !== 12) h += 12
    if (period === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) return parseInt(match24[1]) * 60 + parseInt(match24[2])
  return null
}

function minutesToTimeStr(mins: number, use12h = true): string {
  const h24 = Math.floor(mins / 60) % 24
  const m = mins % 60
  if (!use12h) return `${h24}:${m.toString().padStart(2, '0')}`
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}

function cascadeTimes(
  places: any[],
  changedIndex: number,
  newTime: string,
): { updatedPlaces: any[]; adjustedCount: number } {
  const oldTime = places[changedIndex]?.arrivalTime
  const oldMins = oldTime ? parseTimeToMinutes(oldTime) : null
  const newMins = parseTimeToMinutes(newTime)

  if (oldMins === null || newMins === null || oldMins === newMins) {
    return {
      updatedPlaces: places.map((p: any, i: number) =>
        i === changedIndex ? { ...p, arrivalTime: newTime } : p,
      ),
      adjustedCount: 0,
    }
  }

  const delta = newMins - oldMins
  let adjustedCount = 0

  const updatedPlaces = places.map((p: any, i: number) => {
    if (i === changedIndex) return { ...p, arrivalTime: newTime }
    if (i <= changedIndex || !p.arrivalTime) return p

    const currentMins = parseTimeToMinutes(p.arrivalTime)
    if (currentMins === null) return p

    const adjusted = currentMins + delta

    // Meal-time guards
    const isLunchMeal = p.type === 'restaurant' && currentMins >= 660 && currentMins <= 840
    const isDinnerMeal = p.type === 'restaurant' && currentMins >= 1020 && currentMins <= 1260

    if (isLunchMeal && adjusted < 690) return p   // Lunch can't be before 11:30 AM
    if (isDinnerMeal && adjusted < 1080) return p  // Dinner can't be before 6:00 PM
    if (adjusted > 1410) return p                  // Nothing past 11:30 PM
    if (adjusted < 0) return p                     // Nothing before midnight

    adjustedCount++
    const is12h = p.arrivalTime.includes('AM') || p.arrivalTime.includes('PM')
    return { ...p, arrivalTime: minutesToTimeStr(adjusted, is12h) }
  })

  return { updatedPlaces, adjustedCount }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tripId, dayNumber, placeIndex, newTime, language } = body

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (await isRateLimited(`updatetime:${ip}`, 30, 3600)) {
      return rateLimitResponse(language)
    }

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

    // Apply cascade: update the changed place + adjust subsequent places
    const { updatedPlaces, adjustedCount } = cascadeTimes(day.places, placeIndex, newTime)

    const updatedDays = trip.days.map((d, di) =>
      di === dayIndex ? { ...d, places: updatedPlaces } : d,
    )

    const updatedTrip = { ...trip, days: updatedDays }
    await saveTrip(tripId, updatedTrip)
    revalidatePath(`/trip/${tripId}`)

    return NextResponse.json({ success: true, adjustedCount, trip: updatedTrip })
  } catch (err) {
    console.error('[update-place-time] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update time' },
      { status: 500 },
    )
  }
}
