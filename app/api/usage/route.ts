import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateUID, resolveUID, getUsageForClient } from '@/lib/usage'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = (session?.user as any)?.id as string | undefined
  const cookieUID = await getOrCreateUID()
  const uid = resolveUID(userId, cookieUID)

  const url = new URL(request.url)
  const native = url.searchParams.get('native') === '1'

  const usage = await getUsageForClient(uid, native)
  return Response.json(usage)
}
