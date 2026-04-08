// Biometric (Face ID / Touch ID) helpers.
//
// Strategy: the WebView already holds the NextAuth session cookie. We don't
// store the session ourselves. Instead, we keep two boolean preferences:
//   - "biometricEnabled" → user has opted in to the launch lock
//   - "biometricAsked"   → we've already shown the first-run opt-in prompt
// When enabled, BiometricLock renders a full-screen overlay on launch and
// resume that requires Face ID before revealing the app.
import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
  BiometryType,
} from '@aparajita/capacitor-biometric-auth'
import { isNative } from './index'

const PREF_KEY = 'lulgo.biometricEnabled'
const ASKED_KEY = 'lulgo.biometricAsked'

export type BiometryAvailability = {
  available: boolean
  type: 'faceId' | 'touchId' | 'none'
  reason?: string
}

export type AuthFailureReason =
  | 'web'
  | 'cancel'
  | 'lockout'
  | 'notEnrolled'
  | 'unavailable'
  | 'passcodeNotSet'
  | 'failed'
  | 'error'

export type AuthResult =
  | { ok: true }
  | { ok: false; reason: AuthFailureReason }

export async function checkAvailability(): Promise<BiometryAvailability> {
  if (!isNative()) return { available: false, type: 'none', reason: 'web' }
  try {
    const r = await BiometricAuth.checkBiometry()
    if (!r.isAvailable) {
      return { available: false, type: 'none', reason: r.reason }
    }
    if (r.biometryType === BiometryType.faceId) return { available: true, type: 'faceId' }
    if (r.biometryType === BiometryType.touchId) return { available: true, type: 'touchId' }
    return { available: false, type: 'none', reason: 'unsupported' }
  } catch {
    return { available: false, type: 'none', reason: 'error' }
  }
}

/**
 * Prompt the user for biometric authentication. Returns a structured result so
 * the UI can distinguish "user cancelled" (show retry) from "lockout / not
 * enrolled" (show alternate path) from generic errors.
 */
export async function authenticate(reason: string): Promise<AuthResult> {
  if (!isNative()) return { ok: false, reason: 'web' }
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      iosFallbackTitle: 'Use passcode',
      allowDeviceCredential: true,
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof BiometryError) {
      switch (err.code) {
        case BiometryErrorType.userCancel:
        case BiometryErrorType.appCancel:
        case BiometryErrorType.systemCancel:
          return { ok: false, reason: 'cancel' }
        case BiometryErrorType.biometryLockout:
          return { ok: false, reason: 'lockout' }
        case BiometryErrorType.biometryNotEnrolled:
          return { ok: false, reason: 'notEnrolled' }
        case BiometryErrorType.biometryNotAvailable:
          return { ok: false, reason: 'unavailable' }
        case BiometryErrorType.passcodeNotSet:
        case BiometryErrorType.noDeviceCredential:
          return { ok: false, reason: 'passcodeNotSet' }
        case BiometryErrorType.authenticationFailed:
          return { ok: false, reason: 'failed' }
        default:
          return { ok: false, reason: 'error' }
      }
    }
    console.warn('[biometric] auth failed:', err)
    return { ok: false, reason: 'error' }
  }
}

export function isEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PREF_KEY) === '1'
}

export function setEnabled(on: boolean) {
  if (typeof window === 'undefined') return
  if (on) window.localStorage.setItem(PREF_KEY, '1')
  else window.localStorage.removeItem(PREF_KEY)
}

/** True once the user has been shown the first-run "enable Face ID" prompt. */
export function hasBeenAsked(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ASKED_KEY) === '1'
}

export function markAsked() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ASKED_KEY, '1')
}

/** Reset the "asked" + "enabled" state — used when the user signs out. */
export function resetBiometricState() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PREF_KEY)
  window.localStorage.removeItem(ASKED_KEY)
}

export { BiometryErrorType }
