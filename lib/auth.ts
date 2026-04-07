import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? '366C9B962T'
const APPLE_KEY_ID = process.env.APPLE_KEY_ID ?? '962FLLSXA7'
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID ?? 'com.lulgo.web'

function getApplePrivateKey(): string {
  // Prefer env var (Vercel) — supports literal "\n" escapes
  const envKey = process.env.APPLE_PRIVATE_KEY
  if (envKey && envKey.trim()) {
    return envKey.replace(/\\n/g, '\n')
  }
  // Local dev fallback: read .p8 from project root
  try {
    return fs.readFileSync(
      path.join(process.cwd(), `AuthKey_${APPLE_KEY_ID}.p8`),
      'utf8'
    )
  } catch {
    return ''
  }
}

function generateAppleClientSecret(): string {
  const privateKey = getApplePrivateKey()
  if (!privateKey) return ''
  try {
    return jwt.sign({}, privateKey, {
      algorithm: 'ES256',
      expiresIn: '180d', // Apple max is 6 months
      audience: 'https://appleid.apple.com',
      issuer: APPLE_TEAM_ID,
      subject: APPLE_CLIENT_ID,
      keyid: APPLE_KEY_ID,
    })
  } catch (err) {
    console.error('Failed to sign Apple client secret:', err)
    return ''
  }
}

// Generated once per server boot. Apple JWTs can live up to 6 months,
// so this is fine for serverless cold starts.
const appleClientSecret = generateAppleClientSecret()

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(appleClientSecret
      ? [
          AppleProvider({
            clientId: APPLE_CLIENT_ID,
            clientSecret: appleClientSecret,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in: persist user info into the JWT.
      // Apple only sends name on the FIRST authorization, so we must capture it here.
      if (user) {
        if (user.name) token.name = user.name
        if (user.email) token.email = user.email
        if (user.image) token.picture = user.image
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub
        // Ensure name/email/image flow through for both Google and Apple
        if (token.name) session.user.name = token.name as string
        if (token.email) session.user.email = token.email as string
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
}
