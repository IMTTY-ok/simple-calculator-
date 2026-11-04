import { KEYPAD_LAYOUT, type KeyDefinition } from '../../engine/keyDefinitions'
import type { Operator } from '../../types/calculator'
import { CalculatorButton } from './CalculatorButton'

interface KeypadProps {
  /** The operator currently pending, highlighted on its key. */
  activeOperator: Operator | null
  onPress: (definition: KeyDefinition) => void
}

/**
 * The five-column keypad.
 *
 * `0` spans two columns and `=` spans four rows; every other key occupies a
 * single cell. The grid is sized by the available height, so the keys grow on
 * tall screens and shrink gracefully on short ones.
 */
export function Keypad({ activeOperator, onPress }: KeypadProps) {
  return (
    <div
      className="calculator-keypad"
      role="group"
      aria-label="Keypad"
      style={{
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(5, minmax(0, 1fr))',
      }}
    >
      {KEYPAD_LAYOUT.map((placement) => (
        <CalculatorButton
          key={placement.key.id}
          definition={placement.key}
          placement={placement}
          selected={
            placement.key.variant === 'operator' &&
            placement.key.action.type === 'operator' &&
            placement.key.action.op === activeOperator
          }
          onPress={onPress}
        />
      ))}
    </div>
  )
}
