/**
 * Core calculator domain types.
 *
 * The calculator is modelled as a *token stream* rather than a string. A
 * string would require re-parsing on every keystroke and would make the
 * "trailing operator" case ambiguous. Tokens make every state transition
 * explicit and keep the expression display exact.
 */

/** Arithmetic operators supported by the engine. */
export type Operator = '+' | '-' | '*' | '/'

/** Reasons an expression can fail to evaluate. */
export type CalculationErrorCode = 'divide-by-zero' | 'invalid'

/**
 * A single element of the expression being edited.
 *
 * - `number` carries both the numeric value and the raw text the user typed
 *   (so `0.50` can be echoed back verbatim).
 * - `operator` is a binary operator.
 * - `percent` is a postfix operator applied to the preceding number.
 */
export type Token =
  | { kind: 'number'; value: number; raw: string }
  | { kind: 'operator'; op: Operator }
  | { kind: 'percent' }

/** Every mutation the calculator engine understands. */
export type CalculatorAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'operator'; op: Operator }
  | { type: 'equals' }
  | { type: 'backspace' }
  | { type: 'clear-entry' }
  | { type: 'clear-all' }
  | { type: 'toggle-sign' }
  | { type: 'percent' }
  | { type: 'set-entry'; value: string }

/** Immutable state of the calculator. */
export interface CalculatorState {
  /** Committed expression tokens (the current entry is *not* in here). */
  tokens: Token[]
  /** Raw text of the number currently being typed, e.g. `-12.50`. */
  entry: string | null
  /** Non-null when the expression could not be evaluated. */
  error: CalculationErrorCode | null
  /** True right after `=`; the next digit starts a fresh calculation. */
  justEvaluated: boolean
  /** Human-readable text of the last evaluated expression. */
  lastExpression: string | null
  /** Operator of the last binary operation — used to repeat `=`. */
  lastOperator: Operator | null
  /** Right-hand operand of the last binary operation — used to repeat `=`. */
  lastOperand: number | null
  /** Whether `lastOperand` was scaled by a `%` postfix operator. */
  lastOperandPercent: boolean
  /**
   * Increments whenever the display is cleared.
   *
   * The display uses it to replay a short reset motion without animating
   * every digit the user types.
   */
  resetCount: number
}

/** A single completed calculation kept in the history list. */
export interface HistoryEntry {
  id: string
  /** The expression as the user saw it, e.g. `200 + 10%`. */
  expression: string
  /** The formatted result, e.g. `220`. */
  result: string
  /** The raw numeric result, used when the entry is reused. */
  value: number
  /** Epoch milliseconds. */
  timestamp: number
}

/** Keys of the keypad, used for keyboard mapping and accessible labels. */
export type KeyId =
  | 'ac'
  | 'ce'
  | 'backspace'
  | 'percent'
  | 'sign'
  | 'divide'
  | 'multiply'
  | 'subtract'
  | 'add'
  | 'decimal'
  | 'equals'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
