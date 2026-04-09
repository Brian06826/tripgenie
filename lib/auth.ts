import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? '366C9B962T'
const APPLE_KEY_ID = process.env.APPLE_KEY_ID ?? '962FLLSXA7'
// Accept APPLE_CLIENT_ID (Vercel convention) or APPLE_ID (matches the .env.local
// variable name) — the value should always be the Services ID, e.g. com.lulgo.web
const APPLE_CLIENT_ID =
  process.env.APPLE_CLIENT_ID ??
  process.env.APPLE_ID ??
  'com.lulgo.web'

// ─── Apple private key loading ──────────────────────────────────────────────

/**
 * Normalize a PEM string coming from an env var. Handles three common issues:
 *  - UTF-8 BOM at the start of the paste
 *  - Leading/trailing whitespace
 *  - Vercel/Heroku-style "\n" escaped newlines (instead of real \n)
 */
function normalizePem(raw: string): string {
  let s = raw.replace(/^\uFEFF/, '').trim()
  // If the string has literal backslash-n sequences and no real newlines,
  // convert them. We check both to avoid damaging a key that already has
  // real newlines AND contains a legitimate "\n" string anywhere.
  if (!s.includes('\n') && s.includes('\\n')) {
    s = s.replace(/\\n/g, '\n')
  }
  return s
}

function loadApplePrivateKey(): string {
  // 1. Full PEM in env var (Vercel production convention).
  const envKey = process.env.APPLE_PRIVATE_KEY
  if (envKey && envKey.trim()) {
    return normalizePem(envKey)
  }
  // 2. Path to a .p8 file in env var (matches .env.local convention).
  const envPath = process.env.APPLE_PRIVATE_KEY_PATH
  if (envPath && envPath.trim()) {
    const abs = path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath)
    try {
      return normalizePem(fs.readFileSync(abs, 'utf8'))
    } catch (e) {
      console.error('[apple-auth] failed to read APPLE_PRIVATE_KEY_PATH:', abs, e)
    }
  }
  // 3. Last-resort conventional filename in the project root.
  try {
    return normalizePem(
      fs.readFileSync(
        path.join(process.cwd(), `AuthKey_${APPLE_KEY_ID}.p8`),
        'utf8'
      )
    )
  } catch {
    return ''
  }
}

type PemDiag = {
  lineCount: number
  hasBegin: boolean
  hasEnd: boolean
  byteLength: number
  headLine: string
  tailLine: string
}

function diagnosePem(key: string): PemDiag {
  const lines = key.split('\n')
  return {
    lineCount: lines.length,
    hasBegin: key.includes('-----BEGIN PRIVATE KEY-----'),
    hasEnd: key.includes('-----END PRIVATE KEY-----'),
    byteLength: Buffer.byteLength(key, 'utf8'),
    headLine: lines[0] ?? '',
    tailLine: lines[lines.length - 1] ?? '',
  }
}

// ─── Client secret generation (cached) ──────────────────────────────────────

let cachedAppleSecret: { value: string; expiresAt: number } | null = null
// Whether we've already logged diagnostics for the current boot — avoids
// spamming Vercel logs on every warm invocation.
let diagnosticsLogged = false

/**
 * Build the Apple OAuth client_secret JWT.
 *
 * Apple's spec (https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens):
 *  - alg  ES256
 *  - kid  the Apple Key ID that created the .p8
 *  - iss  the Apple Team ID
 *  - iat  now (seconds since epoch)
 *  - exp  iat + up to 15777000 seconds (~6 months)
 *  - aud  "https://appleid.apple.com"
 *  - sub  the Services ID (client_id)
 *
 * We intentionally:
 *  - cache for 30 minutes so we don't sign on every request
 *  - use a 1-hour expiry (much shorter than the 6-month max) so any bad
 *    secret gets rotated quickly
 *  - subtract 30s from iat as a clock-skew safety margin (some Vercel
 *    runners have drifted ahead of Apple's servers)
 */
function generateAppleClientSecret(): string {
  const nowSec = Math.floor(Date.now() / 1000)
  if (cachedAppleSecret && cachedAppleSecret.expiresAt - 60 > nowSec) {
    return cachedAppleSecret.value
  }

  const privateKey = loadApplePrivateKey()
  if (!privateKey) {
    console.error('[apple-auth] missing APPLE_PRIVATE_KEY / APPLE_PRIVATE_KEY_PATH — Apple sign-in disabled')
    return ''
  }

  const diag = diagnosePem(privateKey)
  if (!diagnosticsLogged) {
    diagnosticsLogged = true
    console.info('[apple-auth] private key diagnostics:', diag)
    console.info('[apple-auth] config:', {
      teamId: APPLE_TEAM_ID,
      keyId: APPLE_KEY_ID,
      clientId: APPLE_CLIENT_ID,
    })
  }
  if (!diag.hasBegin || !diag.hasEnd || diag.lineCount < 3) {
    console.error(
      '[apple-auth] private key does not look like a valid PEM. ' +
      'Check that APPLE_PRIVATE_KEY preserves real newlines between ' +
      '"-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----".',
      diag
    )
    return ''
  }

  const iat = nowSec - 30 // 30s clock-skew margin
  const expiresInSeconds = 60 * 60 // 1 hour, well under Apple's 6-month max

  try {
    const token = jwt.sign(
      {
        iss: APPLE_TEAM_ID,
        iat,
        exp: iat + expiresInSeconds,
        aud: 'https://appleid.apple.com',
        sub: APPLE_CLIENT_ID,
      },
      privateKey,
      {
        algorithm: 'ES256',
        keyid: APPLE_KEY_ID,
      }
    )
    // Decode (no verify) just so we can log the header/payload for audit.
    // The signature is NOT logged, so this is safe.
    const decoded = jwt.decode(token, { complete: true })
    console.info('[apple-auth] signed client secret', {
      header: decoded?.header,
      payload: decoded?.payload,
    })
    // Cache for 30 minutes (half the JWT lifetime).
    cachedAppleSecret = { value: token, expiresAt: iat + 30 * 60 }
    return token
  } catch (err) {
    console.error('[apple-auth] failed to sign client secret:', err)
    return ''
  }
}

// ─── Auth options ──────────────────────────────────────────────────────────

function buildAuthOptions(): NextAuthOptions {
  const appleClientSecret = generateAppleClientSecret()
  return {
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
          (session.user as { id?: string }).id = token.sub
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
    // Apple uses response_mode=form_post → callback is a cross-site POST from
    // appleid.apple.com. Default NextAuth cookies are SameSite=Lax, which browsers
    // do NOT send on cross-site POSTs, causing "PKCE code_verifier cookie was missing".
    // Override the OAuth check cookies to SameSite=None + Secure so they survive.
    cookies: {
      pkceCodeVerifier: {
        name: '__Secure-next-auth.pkce.code_verifier',
        options: {
          httpOnly: true,
          sameSite: 'none',
          path: '/',
          secure: true,
          maxAge: 60 * 15,
        },
      },
      state: {
        name: '__Secure-next-auth.state',
        options: {
          httpOnly: true,
          sameSite: 'none',
          path: '/',
          secure: true,
          maxAge: 60 * 15,
        },
      },
      nonce: {
        name: '__Secure-next-auth.nonce',
        options: {
          httpOnly: true,
          sameSite: 'none',
          path: '/',
          secure: true,
        },
      },
    },
  }
}

/**
 * Returns a fresh NextAuthOptions with an up-to-date Apple client_secret.
 * Called per request from the NextAuth route handler so the secret is always
 * valid (even if the Vercel instance lives longer than the JWT lifetime).
 */
export function getAuthOptions(): NextAuthOptions {
  return buildAuthOptions()
}

// Backward-compatible snapshot for callers that only need `callbacks`/`cookies`
// (e.g. `getServerSession(authOptions)` inside API routes). These paths don't
// exercise the Apple client_secret, so a snapshot at module load is fine.
export const authOptions: NextAuthOptions = buildAuthOptions()
