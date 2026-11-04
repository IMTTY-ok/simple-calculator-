import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor configuration — the bridge between the web build and the native
 * Android application.
 *
 * Everything the app needs at runtime is bundled locally: `webDir` points at
 * the production Vite build, which is copied into the APK/AAB. There is no
 * development server and no remote origin — the installed app works with the
 * network switched off.
 */
const config: CapacitorConfig = {
  appId: 'com.imtty.calculator',
  appName: 'Calculator',
  webDir: 'dist',

  android: {
    // The WebView must never load mixed content.
    allowMixedContent: false,
    // Matches the dark app surface so the launch window does not flash white.
    backgroundColor: '#0a0b0d',
    // Let the system draw the app behind the status bar and let the web layer
    // add the padding for it.
    adjustMarginsForEdgeToEdge: 'auto',
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      // Hand over to the web app as soon as it has rendered.
      launchAutoHide: true,
      launchShowDuration: 400,
      backgroundColor: '#0a0b0d',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },

    StatusBar: {
      // Dark content on a light bar for the light theme; the app flips this at
      // runtime when the theme changes.
      style: 'DARK',
      backgroundColor: '#0a0b0d',
      overlaysWebView: false,
    },

    Haptics: {
      // The app drives haptics itself so it can distinguish interaction
      // classes (digit / operator / equals / clear / error).
    },
  },
}

export default config
