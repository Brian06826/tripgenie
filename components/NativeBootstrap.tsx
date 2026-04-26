'use client'

// Runs once on app mount inside the Capacitor WebView. Hides the splash
// screen, configures the status bar, and handles system back button.
// On the web build, every call is a no-op.
import { useEffect } from 'react'
import { isNative } from '@/lib/native'

export function NativeBootstrap() {
  useEffect(() => {
    if (!isNative()) return
    let cancelled = false
    ;(async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        const { App } = await import('@capacitor/app')
        if (cancelled) return
        // Dark icons on white background to match the brand light UI.
        await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
        await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
        // Hide splash now that the WebView is mounted and React has rendered.
        await SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {})
        // Handle system back button (Android hardware back, iOS handled via swipe gesture)
        await App.addListener('backButton', () => {
          if (window.history.length > 1) {
            window.history.back()
          } else {
            App.exitApp()
          }
        })
      } catch (e) {
        console.warn('[native] bootstrap failed:', e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return null
}
