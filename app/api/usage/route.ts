import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateUID, resolveUID, getUsageForClient } from '@/lib/usage'

export async function GET() {
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = (session?.user as any)?.id as string | undefined
  const cookieUID = await getOrCreateUID()
  const uid = resolveUID(userId, cookieUID)

  const usage = await getUsageForClient(uid)
  return Response.json(usage)
}
