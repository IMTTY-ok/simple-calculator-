/**
 * The keypad layout and the behaviour of every key.
 *
 * Layout rationale
 * ----------------
 * The keypad is a five-column grid. The right-hand column carries the
 * primary action: a tall `=` key spanning four rows, with the sign toggle
 * above it. The fourth column is the operator column (`÷ × − +`) headed by
 * the percentage key. The remaining three columns are the digits, with `0`
 * spanning two cells the way every physical calculator does.
 *
 *   ┌────┬────┬────┬────┬────┐
 *   │ AC │  C │ ⌫  │  % │ ±  │
 *   ├────┼────┼────┼────╞════┤
 *   │  7 │  8 │  9 │  ÷ │    │
 *   ├────┼────┼────┼────╡    │
 *   │  4 │  5 │  6 │  × │ =  │
 *   ├────┼────┼────┼────╡    │
 *   │  1 │  2 │  3 │  − │    │
 *   ├────┴────┼────┼────╞════┤
 *   │    0    │  . │  + │    │
 *   └─────────┴────┴────┴────┘
 */

import type { HapticPattern } from '../hooks/useHaptics.ts'
import type { SoundPattern } from '../hooks/useSound.ts'
import type { CalculatorAction, KeyId } from '../types/calculator.ts'

/** Visual treatment of a key. */
export type KeyVariant = 'digit' | 'function' | 'operator' | 'equals'

/** A single key: what it shows, what it does, and how it feels. */
export interface KeyDefinition {
  id: KeyId
  /** Glyph drawn on the key. */
  label: string
  /** Accessible name announced by screen readers. */
  ariaLabel: string
  /** The action dispatched when the key is pressed. */
  action: CalculatorAction
  /** Haptic pattern fired on press. */
  haptic: HapticPattern
  /** Sound pattern fired on press. */
  sound: SoundPattern
  /** Visual treatment. */
  variant: KeyVariant
}

/** A key plus its position in the grid. */
export interface KeyPlacement {
  key: KeyDefinition
  /** 1-based grid column. */
  column: number
  /** 1-based grid row. */
  row: number
  /** Number of grid columns the key spans. */
  colSpan?: number
  /** Number of grid rows the key spans. */
  rowSpan?: number
}

function digit(digitValue: string): KeyDefinition {
  return {
    id: digitValue as KeyId,
    label: digitValue,
    ariaLabel: digitValue,
    action: { type: 'digit', digit: digitValue },
    haptic: 'digit',
    sound: 'digit',
    variant: 'digit',
  }
}

function operator(id: KeyId, label: string, ariaLabel: string, op: '+' | '-' | '*' | '/'): KeyDefinition {
  return {
    id,
    label,
    ariaLabel,
    action: { type: 'operator', op },
    haptic: 'operator',
    sound: 'operator',
    variant: 'operator',
  }
}

const KEYS: Record<string, KeyDefinition> = {
  ac: {
    id: 'ac',
    label: 'AC',
    ariaLabel: 'Clear all',
    action: { type: 'clear-all' },
    haptic: 'clear',
    sound: 'clear',
    variant: 'function',
  },
  ce: {
    id: 'ce',
    label: 'C',
    ariaLabel: 'Clear current entry',
    action: { type: 'clear-entry' },
    haptic: 'clear',
    sound: 'clear',
    variant: 'function',
  },
  backspace: {
    id: 'backspace',
    label: '⌫',
    ariaLabel: 'Delete last digit',
    action: { type: 'backspace' },
    haptic: 'clear',
    sound: 'clear',
    variant: 'function',
  },
  percent: {
    id: 'percent',
    label: '%',
    ariaLabel: 'Percent',
    action: { type: 'percent' },
    haptic: 'operator',
    sound: 'operator',
    variant: 'function',
  },
  sign: {
    id: 'sign',
    label: '±',
    ariaLabel: 'Change sign',
    action: { type: 'toggle-sign' },
    haptic: 'operator',
    sound: 'operator',
    variant: 'function',
  },
  divide: operator('divide', '÷', 'Divide', '/'),
  multiply: operator('multiply', '×', 'Multiply', '*'),
  subtract: operator('subtract', '−', 'Subtract', '-'),
  add: operator('add', '+', 'Add', '+'),
  decimal: {
    id: 'decimal',
    label: '.',
    ariaLabel: 'Decimal point',
    action: { type: 'decimal' },
    haptic: 'digit',
    sound: 'digit',
    variant: 'digit',
  },
  equals: {
    id: 'equals',
    label: '=',
    ariaLabel: 'Equals',
    action: { type: 'equals' },
    haptic: 'equals',
    sound: 'equals',
    variant: 'equals',
  },
}

/** Every key, keyed by id. */
export const KEY_DEFINITIONS: Record<string, KeyDefinition> = {
  ...KEYS,
  '0': digit('0'),
  '1': digit('1'),
  '2': digit('2'),
  '3': digit('3'),
  '4': digit('4'),
  '5': digit('5'),
  '6': digit('6'),
  '7': digit('7'),
  '8': digit('8'),
  '9': digit('9'),
}

/** The full keypad, in reading order, with explicit grid placement. */
export const KEYPAD_LAYOUT: KeyPlacement[] = [
  { key: KEYS.ac, column: 1, row: 1 },
  { key: KEYS.ce, column: 2, row: 1 },
  { key: KEYS.backspace, column: 3, row: 1 },
  { key: KEYS.percent, column: 4, row: 1 },
  { key: KEYS.sign, column: 5, row: 1 },

  { key: KEY_DEFINITIONS['7'], column: 1, row: 2 },
  { key: KEY_DEFINITIONS['8'], column: 2, row: 2 },
  { key: KEY_DEFINITIONS['9'], column: 3, row: 2 },
  { key: KEYS.divide, column: 4, row: 2 },
  { key: KEYS.equals, column: 5, row: 2, rowSpan: 4 },

  { key: KEY_DEFINITIONS['4'], column: 1, row: 3 },
  { key: KEY_DEFINITIONS['5'], column: 2, row: 3 },
  { key: KEY_DEFINITIONS['6'], column: 3, row: 3 },
  { key: KEYS.multiply, column: 4, row: 3 },

  { key: KEY_DEFINITIONS['1'], column: 1, row: 4 },
  { key: KEY_DEFINITIONS['2'], column: 2, row: 4 },
  { key: KEY_DEFINITIONS['3'], column: 3, row: 4 },
  { key: KEYS.subtract, column: 4, row: 4 },

  { key: KEY_DEFINITIONS['0'], column: 1, row: 5, colSpan: 2 },
  { key: KEYS.decimal, column: 3, row: 5 },
  { key: KEYS.add, column: 4, row: 5 },
]

/**
 * The key vocabulary used by the shared fixture file.
 *
 * Both the frontend engine and the Python reference engine are driven by the
 * same sequences of these tokens, so the fixture file stays the single
 * source of truth for expected behaviour.
 */
export const KEY_SEQUENCE_MAP: Record<string, KeyDefinition> = {
  AC: KEYS.ac,
  C: KEYS.ce,
  '⌫': KEYS.backspace,
  '%': KEYS.percent,
  '±': KEYS.sign,
  '+': KEYS.add,
  '-': KEYS.subtract,
  '×': KEYS.multiply,
  '÷': KEYS.divide,
  '.': KEYS.decimal,
  '=': KEYS.equals,
  '0': KEY_DEFINITIONS['0'],
  '1': KEY_DEFINITIONS['1'],
  '2': KEY_DEFINITIONS['2'],
  '3': KEY_DEFINITIONS['3'],
  '4': KEY_DEFINITIONS['4'],
  '5': KEY_DEFINITIONS['5'],
  '6': KEY_DEFINITIONS['6'],
  '7': KEY_DEFINITIONS['7'],
  '8': KEY_DEFINITIONS['8'],
  '9': KEY_DEFINITIONS['9'],
}
