/**
 * Haptic feedback.
 *
 * ## Two implementations, one API
 *
 * **On Android** the app uses the native Capacitor Haptics plugin, which
 * calls `View.performHapticFeedback` / the platform vibrator. That is real
 * device feedback with the system's own haptic character.
 *
 * **On the web** it falls back to the `navigator.vibrate` Vibration API.
 *
 * ## What the Vibration API can and cannot do
 *
 * `navigator.vibrate(pattern)` accepts a duration in milliseconds or an array
 * of durations and pauses. It does **not** expose intensity — the browser
 * decides how strong the pulse is. Anything claiming to control vibration
 * strength on the web is inaccurate.
 *
 * Support is also uneven: Chromium-based browsers on Android implement it,
 * while iOS Safari does not expose the API at all. The `isHapticsSupported`
 * probe below keeps the app honest — when haptics are unavailable the UI
 * falls back to the (optional) sound cue and the visual press feedback.
 */

import { useCallback, useMemo } from 'react'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/** The distinct feedback patterns used across the app. */
export type HapticPattern = 'digit' | 'operator' | 'equals' | 'clear' | 'error'

/**
 * Vibration patterns in milliseconds, used by the web fallback.
 *
 * - `digit` — a very short tick, the default for every number key.
 * - `operator` — slightly longer, so operators feel different to digits.
 * - `equals` — a double tap that reads as "confirmed".
 * - `clear` — a short double tick that reads as "wiped".
 * - `error` — a long, obviously wrong buzz.
 */
export const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  digit: 8,
  operator: 14,
  equals: [14, 40, 16],
  clear: [10, 35, 10],
  error: [45, 60, 45],
}

/**
 * Fire the native Android haptic for a pattern.
 *
 * `ImpactStyle` maps onto the platform's own "click" feedback, which is what
 * a physical key feels like; `NotificationType` is the stronger, patterned
 * buzz Android reserves for confirmations and errors.
 */
async function triggerNativeHaptics(pattern: HapticPattern): Promise<void> {
  switch (pattern) {
    case 'digit':
      await Haptics.impact({ style: ImpactStyle.Light })
      return
    case 'operator':
      await Haptics.impact({ style: ImpactStyle.Medium })
      return
    case 'equals':
      await Haptics.notification({ type: NotificationType.Success })
      return
    case 'clear':
      await Haptics.impact({ style: ImpactStyle.Heavy })
      return
    case 'error':
      await Haptics.notification({ type: NotificationType.Error })
      return
  }
}

/**
 * Feature-detect haptic support.
 *
 * On a native platform the Capacitor plugin is always available. On the web
 * the check is deliberately conservative: the API must exist *and* be
 * callable. Some browsers define `navigator.vibrate` but throw when it is
 * used outside a user gesture.
 */
export function isHapticsSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * Returns a function that fires the given haptic pattern.
 *
 * The returned function must be called synchronously from a user gesture so
 * the web Vibration API is honoured.
 */
export function useHaptics(enabled: boolean) {
  const supported = useMemo(() => isHapticsSupported(), [])
  const native = useMemo(() => Capacitor.isNativePlatform(), [])

  return useCallback(
    (pattern: HapticPattern) => {
      if (!enabled) return

      if (native) {
        // Fire and forget: a vibration must never delay the calculation.
        void triggerNativeHaptics(pattern).catch(() => undefined)
        return
      }

      if (!supported) return
      try {
        navigator.vibrate(HAPTIC_PATTERNS[pattern])
      } catch {
        /* Vibration can be blocked; never let it break the calculator. */
      }
    },
    [enabled, native, supported],
  )
}
