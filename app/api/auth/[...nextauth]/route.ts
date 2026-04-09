import NextAuth from 'next-auth'
import { getAuthOptions } from '@/lib/auth'

// Build the handler per-request so the Apple client_secret JWT is always
// freshly generated (or served from its 30-minute cache) instead of being
// frozen at cold-start time. This avoids `invalid_grant` errors when a
// long-lived Vercel instance's cached JWT drifts out of Apple's accepted
// window.
async function handler(req: Request, ctx: unknown) {
  // NextAuth's app-router handler signature is (req, ctx) → Response.
  // We cast ctx through unknown because next-auth's typings expect the
  // Next.js route handler context shape, which varies across versions.
  return NextAuth(getAuthOptions())(
    req as unknown as Parameters<ReturnType<typeof NextAuth>>[0],
    ctx as Parameters<ReturnType<typeof NextAuth>>[1]
  )
}

export { handler as GET, handler as POST }
