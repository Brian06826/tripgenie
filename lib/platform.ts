import { Capacitor } from '@capacitor/core'

/** Check if running inside a native Capacitor app (iOS/Android) */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** Check if running on iOS (native app only) */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios'
}
