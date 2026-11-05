import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Ship the repository's privacy policy inside the app bundle.
 *
 * The canonical file lives at the repository root so it can be published as
 * a standalone web page for Google Play; this plugin copies the very same
 * file into the build output so the app can show it offline.
 */
function privacyPolicy(): Plugin {
  return {
    name: 'calculator:privacy-policy',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'privacy-policy.html',
        source: readFileSync(resolve(process.cwd(), 'privacy-policy.html'), 'utf-8'),
      })
    },
  }
}

/**
 * The Android build (`vite build --mode android`) disables the service
 * worker on purpose: the native app already ships every asset inside the
 * APK/AAB, so a service worker would only add a second, failure-prone caching
 * layer in front of the bundled files.
 */
export default defineConfig(({ mode }) => {
  const isAndroid = mode === 'android'

  return {
    // The Android build directory is large and changes on every Gradle run.
    // Watching it makes the dev server reload for files it does not serve.
    server: {
      watch: {
        ignored: ['**/android/**/build/**', '**/release/*.aab', '**/release/*.apk'],
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      privacyPolicy(),
      VitePWA({
        disable: isAndroid,
        registerType: 'autoUpdate',
        includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
        manifest: {
          name: 'Calculator',
          short_name: 'Calculator',
          description:
            'A premium, tactile calculator with haptics, history and offline support.',
          theme_color: '#0a0b0d',
          background_color: '#0a0b0d',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['utilities', 'productivity'],
          icons: [
            { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
          navigateFallback: 'index.html',
          // The privacy policy is a real page of its own — it must be served
          // as-is rather than replaced by the app shell. The pattern is
          // matched against the full URL, so it is not anchored.
          navigateFallbackDenylist: [/\/privacy-policy\.html/],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  }
})
