import { createContext, useContext } from 'react'

/** Theme choices offered in settings. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** The resolved theme actually applied to the document. */
export type ResolvedTheme = 'light' | 'dark'

/** User-visible preferences. */
export interface Settings {
  theme: ThemePreference
  haptics: boolean
  sound: boolean
  /** Force reduced motion regardless of the OS preference. */
  reducedMotion: boolean
}

/** Defaults: dark-first, tactile feedback on, motion follows the OS. */
export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  haptics: true,
  sound: false,
  reducedMotion: false,
}

/** Everything the application needs to know about preferences. */
export interface SettingsContextValue {
  settings: Settings
  /** The theme in effect right now. */
  resolvedTheme: ResolvedTheme
  /** True when either the OS or the in-app switch asks for reduced motion. */
  prefersReducedMotion: boolean
  /** Whether the device exposes the Vibration API. */
  hapticsSupported: boolean
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  toggleTheme: () => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

/** Read the current settings. Must be used inside `SettingsProvider`. */
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
