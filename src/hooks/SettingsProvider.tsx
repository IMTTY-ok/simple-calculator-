import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useMediaQuery } from './useMediaQuery'
import {
  DEFAULT_SETTINGS,
  SettingsContext,
  type ResolvedTheme,
  type Settings,
  type SettingsContextValue,
} from './settingsContext'
import { readStorage, writeStorage } from '../utils/storage'

const STORAGE_KEY = 'settings'

/**
 * Provides user preferences and keeps the document in sync with them.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...readStorage<Partial<Settings>>(STORAGE_KEY, {}),
  }))

  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const systemPrefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const resolvedTheme: ResolvedTheme =
    settings.theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : settings.theme

  const prefersReducedMotion = systemPrefersReducedMotion || settings.reducedMotion

  useEffect(() => {
    writeStorage(STORAGE_KEY, settings)
  }, [settings])

  // Apply the theme class and keep the browser chrome colour in sync.
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)

    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    metas.forEach((meta) => {
      const scheme = meta.dataset.scheme
      if (!scheme) return
      if (settings.theme === 'system') {
        meta.setAttribute('media', `(prefers-color-scheme: ${scheme})`)
      } else {
        meta.setAttribute('media', scheme === resolvedTheme ? 'all' : 'not all')
      }
    })
  }, [resolvedTheme, settings.theme])

  // Apply reduced motion.
  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', prefersReducedMotion)
  }, [prefersReducedMotion])

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((previous) => ({ ...previous, [key]: value }))
    },
    [],
  )

  const toggleTheme = useCallback(() => {
    setSettings((previous) => ({
      ...previous,
      theme: previous.theme === 'dark' ? 'light' : 'dark',
    }))
  }, [])

  const hapticsSupported =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      resolvedTheme,
      prefersReducedMotion,
      hapticsSupported,
      setSetting,
      toggleTheme,
    }),
    [settings, resolvedTheme, prefersReducedMotion, hapticsSupported, setSetting, toggleTheme],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
