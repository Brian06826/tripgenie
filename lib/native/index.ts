// Native runtime detection. Safe to import from any client component —
// returns false on the server and on the web build.
import { Capacitor } from '@capacitor/core'

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function isIOS(): boolean {
  try {
    return Capacitor.getPlatform() === 'ios'
  } catch {
    return false
  }
}
