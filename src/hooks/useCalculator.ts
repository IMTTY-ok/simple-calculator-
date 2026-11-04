import { useCallback, useEffect, useRef, useState } from 'react'

import {
  calculatorReducer,
  createInitialState,
  deriveDisplay,
  findLastNumber,
  type DisplayState,
} from '../engine/calculatorEngine'
import { formatNumber } from '../engine/formatter'
import { useHaptics, type HapticPattern } from './useHaptics'
import { useSound, type SoundPattern } from './useSound'
import { createId } from '../utils/storage'
import type { CalculatorAction, CalculatorState, HistoryEntry } from '../types/calculator'

/** Feedback category used for a given action. */
interface Feedback {
  haptic: HapticPattern
  sound: SoundPattern
}

/** Map an action to the tactile and audible response it should produce. */
function feedbackFor(action: CalculatorAction): Feedback {
  switch (action.type) {
    case 'digit':
    case 'decimal':
      return { haptic: 'digit', sound: 'digit' }
    case 'operator':
    case 'percent':
    case 'toggle-sign':
      return { haptic: 'operator', sound: 'operator' }
    case 'equals':
      return { haptic: 'equals', sound: 'equals' }
    case 'backspace':
    case 'clear-entry':
    case 'clear-all':
      return { haptic: 'clear', sound: 'clear' }
    case 'set-entry':
      return { haptic: 'digit', sound: 'digit' }
  }
}

export interface UseCalculatorOptions {
  hapticsEnabled: boolean
  soundEnabled: boolean
  /** Called whenever a new calculation completes. */
  onResult: (entry: HistoryEntry) => void
}

export interface UseCalculatorResult {
  state: CalculatorState
  display: DisplayState
  /** Apply an action, firing the matching feedback. */
  dispatch: (action: CalculatorAction) => void
}

/**
 * Binds the pure engine to the browser: state, feedback and history.
 *
 * The reducer runs first and synchronously so the UI is never waiting on a
 * side effect; the haptic and sound cues are fired in the same task as the
 * user gesture, which is what the browser requires.
 */
export function useCalculator({
  hapticsEnabled,
  soundEnabled,
  onResult,
}: UseCalculatorOptions): UseCalculatorResult {
  const [state, setState] = useState<CalculatorState>(createInitialState)
  const stateRef = useRef(state)

  const vibrate = useHaptics(hapticsEnabled)
  const playSound = useSound(soundEnabled)

  // Keep the callback fresh without re-creating `dispatch` on every render.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const dispatch = useCallback(
    (action: CalculatorAction) => {
      const previous = stateRef.current
      const next = calculatorReducer(previous, action)
      stateRef.current = next
      setState(next)

      // A failed calculation gets the error cue instead of the normal one.
      if (next.error !== null && previous.error === null) {
        vibrate('error')
        playSound('error')
      } else {
        const feedback = feedbackFor(action)
        vibrate(feedback.haptic)
        playSound(feedback.sound)
      }

      // Record a history entry for each *new* completed calculation.
      const completedNewResult =
        next.justEvaluated && !previous.justEvaluated && next.lastOperator !== null

      if (completedNewResult && next.lastExpression !== null) {
        const value = findLastNumber(next.tokens) ?? 0
        onResultRef.current({
          id: createId(),
          expression: next.lastExpression,
          result: formatNumber(value),
          value,
          timestamp: Date.now(),
        })
      }
    },
    [playSound, vibrate],
  )

  const display = deriveDisplay(state)

  return { state, display, dispatch }
}
