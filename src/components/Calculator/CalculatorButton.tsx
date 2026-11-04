import type { CSSProperties } from 'react'

import type { KeyDefinition, KeyPlacement } from '../../engine/keyDefinitions'
import { cn } from '../../utils/cn'

interface CalculatorButtonProps {
  definition: KeyDefinition
  placement: KeyPlacement
  /** True when this operator is the pending operation. */
  selected: boolean
  onPress: (definition: KeyDefinition) => void
}

/**
 * A single key.
 *
 * Press feedback is delivered on `pointerdown` so the tactile response lands
 * the instant a finger touches the glass, while keyboard activation and
 * assistive-technology clicks arrive through `click` (reported with
 * `detail === 0`).
 */
export function CalculatorButton({
  definition,
  placement,
  selected,
  onPress,
}: CalculatorButtonProps) {
  const gridStyle: CSSProperties = {
    gridColumn: `${placement.column} / span ${placement.colSpan ?? 1}`,
    gridRow: `${placement.row} / span ${placement.rowSpan ?? 1}`,
  }

  return (
    <button
      type="button"
      className={cn('calc-key', `calc-key--${definition.variant}`, selected && 'calc-key--selected')}
      style={gridStyle}
      aria-label={definition.ariaLabel}
      aria-pressed={definition.variant === 'operator' ? selected : undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        onPress(definition)
      }}
      onClick={(event) => {
        // Pointer presses already dispatched on `pointerdown`; only
        // keyboard/assistive-technology clicks reach this point.
        if (event.detail === 0) onPress(definition)
      }}
    >
      <span className="calc-key__label" aria-hidden="true">
        {definition.label}
      </span>
    </button>
  )
}
