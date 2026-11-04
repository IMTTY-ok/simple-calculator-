import { useEffect, useState } from 'react'

import type { KeyDefinition } from '../../engine/keyDefinitions'
import type { DisplayState } from '../../engine/calculatorEngine'
import type { Operator } from '../../types/calculator'
import { Display, type CopyStatus } from './Display'
import { Keypad } from './Keypad'

interface CalculatorProps {
  display: DisplayState
  activeOperator: Operator | null
  onPress: (definition: KeyDefinition) => void
  /** Increments whenever the display is cleared, to replay the reset motion. */
  resetSignal: number
}

/**
 * The calculator surface: display on top, keypad below.
 *
 * On phones the card fills the viewport and the keypad absorbs the leftover
 * height, so the keys are always comfortably large. From tablet width
 * upwards the card takes a deliberate fixed size instead of stretching.
 */
export function Calculator({ display, activeOperator, onPress, resetSignal }: CalculatorProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  // Copy the current result to the clipboard.
  const handleCopy = async () => {
    const text = display.value
    if (!text || display.error) return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for insecure contexts and older browsers.
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      }
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  // Reset the confirmation after a moment.
  useEffect(() => {
    if (copyStatus === 'idle') return
    const timer = window.setTimeout(() => setCopyStatus('idle'), 1600)
    return () => window.clearTimeout(timer)
  }, [copyStatus])

  return (
    <section className="calculator-card card-surface" aria-label="PULSE CALC calculator">
      <Display
        expression={display.expression}
        value={display.value}
        preview={display.preview}
        hasError={display.error !== null}
        onCopy={handleCopy}
        copyStatus={copyStatus}
        resetSignal={resetSignal}
      />
      <Keypad activeOperator={activeOperator} onPress={onPress} />
    </section>
  )
}
