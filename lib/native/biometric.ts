// Biometric (Face ID / Touch ID) helpers.
//
// Strategy: the WebView already holds the NextAuth session cookie. We don't
// store the session ourselves. Instead, we keep a single boolean preference
// ("biometricEnabled") and, when set, render a full-screen lock overlay on
// app launch that requires Face ID before revealing the app.
import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
  BiometryType,
} from '@aparajita/capacitor-biometric-auth'
import { isNative } from './index'

const PREF_KEY = 'lulgo.biometricEnabled'

export type BiometryAvailability = {
  available: boolean
  type: 'faceId' | 'touchId' | 'none'
  reason?: string
}

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

export async function authenticate(reason: string): Promise<boolean> {
  if (!isNative()) return true
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      iosFallbackTitle: 'Use passcode',
      allowDeviceCredential: true,
    })
    return true
  } catch (err) {
    if (err instanceof BiometryError) {
      // user cancel / lockout / not enrolled — caller decides what to do
      console.warn('[biometric] auth failed:', err.code, err.message)
    }
    return false
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

export { BiometryErrorType }
