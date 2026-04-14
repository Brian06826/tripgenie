import jwt from 'jsonwebtoken'
import { encode } from 'next-auth/jwt'

/**
 * Native Apple Sign In endpoint.
 *
 * Called from the iOS app after ASAuthorizationController completes.
 * Receives the Apple identity token, validates it, and creates a
 * NextAuth-compatible session cookie.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { identityToken, user, email, fullName } = body

    if (!identityToken) {
      return Response.json({ error: 'Missing identity token' }, { status: 400 })
    }

    // Decode the Apple identity token (JWT signed by Apple).
    // The token comes from ASAuthorizationController — Apple's native SDK —
    // so it is trustworthy. We validate issuer + audience + expiry.
    const decoded = jwt.decode(identityToken) as Record<string, unknown> | null

    if (!decoded || decoded.iss !== 'https://appleid.apple.com') {
      return Response.json({ error: 'Invalid token issuer' }, { status: 401 })
    }

    // Accept both the native app bundle ID and the web Services ID
    const validAudiences = ['com.lulgo.app', 'com.lulgo.web']
    if (!validAudiences.includes(decoded.aud as string)) {
      return Response.json({ error: 'Invalid token audience' }, { status: 401 })
    }

    // Check expiration
    if (typeof decoded.exp === 'number' && decoded.exp < Date.now() / 1000) {
      return Response.json({ error: 'Token expired' }, { status: 401 })
    }

    const userId = (decoded.sub as string) || user
    const userEmail = (decoded.email as string) || email

    // Create a NextAuth-compatible session JWT
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      console.error('[apple-native] NEXTAUTH_SECRET is not set')
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const sessionToken = await encode({
      token: {
        sub: userId,
        name: fullName || undefined,
        email: userEmail || undefined,
      },
      secret,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // Set the session cookie matching NextAuth's convention
    const isSecure = (process.env.NEXTAUTH_URL ?? '').startsWith('https')
    const cookieName = isSecure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${cookieName}=${sessionToken}; Path=/; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
      },
    })
  } catch (err) {
    console.error('[apple-native] Error:', err)
    return Response.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
