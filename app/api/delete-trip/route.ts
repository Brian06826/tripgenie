import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteTrip } from '@/lib/storage'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = (session?.user as any)?.id as string | undefined

  if (!userId) {
    return Response.json({ error: 'not_authenticated' }, { status: 401 })
  }

  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const id = body?.id
  if (!id || typeof id !== 'string') {
    return Response.json({ error: 'missing_id' }, { status: 400 })
  }

  const ok = await deleteTrip(id, userId)
  if (!ok) {
    return Response.json({ error: 'not_found_or_forbidden' }, { status: 404 })
  }

  return Response.json({ ok: true })
}
