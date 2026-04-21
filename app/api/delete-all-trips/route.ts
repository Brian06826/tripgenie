import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserTripIds, deleteTrip } from '@/lib/storage'

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = (session?.user as any)?.id as string | undefined

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tripIds = await getUserTripIds(userId)
  let deleted = 0

  await Promise.all(
    tripIds.map(async (id) => {
      const ok = await deleteTrip(id, userId)
      if (ok) deleted++
    })
  )

  return Response.json({ ok: true, deleted })
}
