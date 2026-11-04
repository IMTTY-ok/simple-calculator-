import { useEffect } from 'react'

import type { CalculatorAction } from '../types/calculator'

/** Map a keyboard event to a calculator action, or `null` if unhandled. */
export function keyEventToAction(event: KeyboardEvent): CalculatorAction | null {
  const { key } = event

  if (key >= '0' && key <= '9') {
    return { type: 'digit', digit: key }
  }

  switch (key) {
    case '.':
    case ',':
      return { type: 'decimal' }
    case '+':
      return { type: 'operator', op: '+' }
    case '-':
    case '−': // typographic minus
      return { type: 'operator', op: '-' }
    case '*':
    case '×': // multiplication sign
      return { type: 'operator', op: '*' }
    case '/':
    case '÷': // division sign
      return { type: 'operator', op: '/' }
    case '=':
    case 'Enter':
      return { type: 'equals' }
    case 'Backspace':
      return { type: 'backspace' }
    case 'Escape':
    case 'Delete':
      return { type: 'clear-all' }
    case 'c':
    case 'C':
      return { type: 'clear-entry' }
    case '%':
      return { type: 'percent' }
    case '~':
    case 'n':
    case 'N':
      return { type: 'toggle-sign' }
    default:
      return null
  }
}

/**
 * Bind calculator keys to the physical keyboard.
 *
 * Typing into a text field is never intercepted — the calculator has no text
 * inputs today, but the guard keeps the behaviour correct if that changes.
 */
export function useKeyboard(
  onAction: (action: CalculatorAction) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      const action = keyEventToAction(event)
      if (!action) return

      // Stop the browser from doing its own thing (quick-find, back-navigation,
      // form submission, …).
      event.preventDefault()
      onAction(action)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onAction])
}
