import { getTrip } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const trip = await getTrip(id)

  if (!trip) {
    return Response.json({ status: 'generating' })
  }

  return Response.json({
    status: 'ready',
    validated: trip.validated ?? false,
  })
}
