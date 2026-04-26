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
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    allowsBackForwardNavigationGestures: true,
  },
  plugins: {
    SplashScreen: {
      // Hide manually from JS after the WebView reports ready, to avoid a
      // white flash before lulgo.com finishes loading.
      launchAutoHide: false,
      launchShowDuration: 3000,
      backgroundColor: '#ffffff',
      showSpinner: true,
      iosSpinnerStyle: 'small',
      spinnerColor: '#f97316', // brand orange
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Dark icons on white background to match the splash + light UI.
      style: 'DARK',
      overlaysWebView: false,
    },
  },
}

export default config
