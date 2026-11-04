import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'

import type { ResolvedTheme } from './settingsContext'

/** The surface colour behind the system bars, per theme. */
const BAR_COLOURS: Record<ResolvedTheme, string> = {
  dark: '#0a0b0d',
  light: '#edeae4',
}

/**
 * Keep the Android system bars in step with the app theme.
 *
 * `Style.Dark` means *light text on a dark background* — the naming is the
 * Android convention, not a description of the text colour.
 */
export function useNativeStatusBar(theme: ResolvedTheme): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    void (async () => {
      try {
        // The web layer is inset below the status bar rather than drawing
        // underneath it, so the layout never has to compensate for it.
        await StatusBar.setOverlaysWebView({ overlay: false })
        await StatusBar.setStyle({
          style: theme === 'dark' ? Style.Dark : Style.Light,
        })
        await StatusBar.setBackgroundColor({ color: BAR_COLOURS[theme] })
      } catch {
        /* Not every device exposes the status bar API — never fatal. */
      }
    })()
  }, [theme])
}

/**
 * Wire the Android back button.
 *
 * Without this, Capacitor's own handler swallows the back press on the root
 * screen and the app becomes impossible to leave with the gesture. The
 * listener takes over: it closes an open panel first, then walks the web
 * history, and only exits the app when there is nowhere left to go.
 */
export function useNativeBackButton(
  panelOpen: boolean,
  onClosePanel: () => void,
): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let remove: (() => void) | undefined

    void CapApp.addListener('backButton', ({ canGoBack }) => {
      if (panelOpen) {
        onClosePanel()
        return
      }
      if (canGoBack) {
        window.history.back()
        return
      }
      void CapApp.exitApp()
    }).then((handle) => {
      remove = () => {
        void handle.remove()
      }
    })

    return () => remove?.()
  }, [panelOpen, onClosePanel])
}
