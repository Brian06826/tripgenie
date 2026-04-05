import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.lulgo.app',
  appName: 'Lulgo',
  webDir: 'public',
  // Remote URL mode — WebView loads the live site
  server: {
    url: 'https://lulgo.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0f1b2d',
    },
    StatusBar: {
      style: 'LIGHT',
    },
  },
}

export default config
