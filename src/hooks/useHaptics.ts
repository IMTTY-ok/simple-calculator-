/**
 * Haptic feedback.
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

/** The distinct feedback patterns used across the app. */
export type HapticPattern = 'digit' | 'operator' | 'equals' | 'clear' | 'error'

/**
 * Vibration patterns in milliseconds.
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
 * Feature-detect vibration support.
 *
 * The check is deliberately conservative: the API must exist *and* be
 * callable. Some browsers define `navigator.vibrate` but throw when it is
 * used outside a user gesture.
 */
export function isHapticsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  )
}

/**
 * Returns a function that fires the given haptic pattern.
 *
 * The returned function must be called synchronously from a user gesture for
 * the vibration to be honoured by the browser.
 */
export function useHaptics(enabled: boolean) {
  const supported = useMemo(() => isHapticsSupported(), [])

  return useCallback(
    (pattern: HapticPattern) => {
      if (!enabled || !supported) return
      try {
        navigator.vibrate(HAPTIC_PATTERNS[pattern])
      } catch {
        /* Vibration can be blocked; never let it break the calculator. */
      }
    },
    [enabled, supported],
  )
}
