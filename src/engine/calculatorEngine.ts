/**
 * The calculator state machine.
 *
 * This module is deliberately pure: it holds no React, no DOM and no timers.
 * Every transition is a `(state, action) -> state` function, which makes the
 * behaviour exhaustively testable from Node and lets the Python reference
 * engine mirror it exactly.
 *
 * ---------------------------------------------------------------------------
 * Documented behaviour
 * ---------------------------------------------------------------------------
 * Entry
 *   Digits, a decimal point and `±` build the *entry* — the raw text the user
 *   is typing. The entry is committed to the token stream when an operator,
 *   `%` or `=` is pressed.
 *
 * Operators
 *   `+ − × ÷` have standard precedence (`2 + 3 × 4` is `14`). Pressing a
 *   second operator replaces the pending one.
 *
 * Percentage
 *   See `expressionParser.ts` for the exact rules.
 *
 * Repeated equals
 *   `2 + 3 =` → `5`. Pressing `=` again repeats the last binary operation:
 *   `5 + 3 =` → `8`. The repeated operand is re-scaled when it was a
 *   percentage, so `200 + 10% =` → `220`, and `=` again gives
 *   `220 + 10% of 220` → `242`.
 *
 * Division by zero
 *   Produces an explicit error state; the expression is discarded and the
 *   next key press starts over.
 */

import {
  cleanNumber,
  formatEntry,
  formatNumber,
  formatTokens,
  OPERATOR_SYMBOL,
  parseEntry,
} from './formatter.ts'
import {
  CalculationError,
  evaluateTokens,
  stripTrailingOperator,
  type CalculationErrorCode,
} from './expressionParser.ts'
import type {
  CalculatorAction,
  CalculatorState,
  Operator,
  Token,
} from '../types/calculator.ts'

/** Maximum number of digits a single entry may contain. */
export const MAX_ENTRY_DIGITS = 16

/** Human-readable copy for each failure mode. */
export const ERROR_MESSAGES: Record<CalculationErrorCode, string> = {
  'divide-by-zero': 'Cannot divide by zero',
  invalid: 'Invalid expression',
}

/** Create the empty calculator state. */
export function createInitialState(): CalculatorState {
  return {
    tokens: [],
    entry: null,
    error: null,
    justEvaluated: false,
    lastExpression: null,
    lastOperator: null,
    lastOperand: null,
    lastOperandPercent: false,
    resetCount: 0,
  }
}

/** Build a number token from raw user text. */
function numberToken(raw: string): Token {
  return { kind: 'number', value: parseEntry(raw), raw }
}

/** Build a number token from a computed value. */
function numberTokenFromValue(value: number): { kind: 'number'; value: number; raw: string } {
  const cleaned = cleanNumber(value)
  return { kind: 'number', value: cleaned, raw: String(cleaned) }
}

/** The last number in a token stream, or `null` when there is none. */
export function findLastNumber(tokens: Token[]): number | null {
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i]
    if (token.kind === 'number') return token.value
  }
  return null
}

/**
 * True when the expression is closed and a digit should start a new
 * calculation: immediately after `=`, or right after a `%`.
 */
function isSealed(state: CalculatorState): boolean {
  if (state.justEvaluated) return true
  const last = state.tokens[state.tokens.length - 1]
  return state.entry === null && !!last && last.kind === 'percent'
}

/** Append a digit to the raw entry, respecting leading zeros and length. */
function appendDigit(entry: string | null, digit: string): string | null {
  if (entry === null) return digit

  const negative = entry.startsWith('-')
  const body = negative ? entry.slice(1) : entry
  if (body.replace('.', '').length >= MAX_ENTRY_DIGITS) return entry

  // `0` becomes `0…` rather than `00…`, and `-0` becomes `-5`.
  if (body === '0') return `${negative ? '-' : ''}${digit}`

  return entry + digit
}

/** Remove the last character of the raw entry. */
function backspaceEntry(entry: string): string | null {
  if (entry.length <= 1) return null
  const next = entry.slice(0, -1)
  if (next === '-' || next === '') return null
  return next
}

/** Evaluate without throwing. */
function evaluateSafe(tokens: Token[]): { ok: true; value: number } | { ok: false; code: CalculationErrorCode } {
  if (tokens.length === 0) return { ok: false, code: 'invalid' }
  try {
    return { ok: true, value: evaluateTokens(tokens) }
  } catch (error) {
    if (error instanceof CalculationError) return { ok: false, code: error.code }
    return { ok: false, code: 'invalid' }
  }
}

/**
 * The pure calculator reducer.
 */
export function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    /* ------------------------------------------------------------------ */
    case 'digit': {
      if (state.error) {
        return { ...createInitialState(), entry: action.digit, resetCount: state.resetCount }
      }
      if (isSealed(state)) {
        return { ...createInitialState(), entry: action.digit, resetCount: state.resetCount }
      }
      const entry = appendDigit(state.entry, action.digit)
      if (entry === null) return state
      return {
        ...state,
        entry,
        lastOperand: parseEntry(entry),
        lastOperandPercent: false,
      }
    }

    /* ------------------------------------------------------------------ */
    case 'decimal': {
      if (state.error) {
        return { ...createInitialState(), entry: '0.', resetCount: state.resetCount }
      }
      if (isSealed(state)) {
        return { ...createInitialState(), entry: '0.', resetCount: state.resetCount }
      }
      if (state.entry === null) {
        return { ...state, entry: '0.', lastOperand: 0, lastOperandPercent: false }
      }
      if (state.entry.includes('.')) return state
      return {
        ...state,
        entry: `${state.entry}.`,
        lastOperand: parseEntry(state.entry),
        lastOperandPercent: false,
      }
    }

    /* ------------------------------------------------------------------ */
    case 'operator': {
      if (state.error) return { ...createInitialState(), resetCount: state.resetCount }

      // A leading minus starts a negative number, the way a physical
      // calculator does — otherwise "− 5" would silently read as "5".
      if (
        state.tokens.length === 0 &&
        state.entry === null &&
        !state.justEvaluated &&
        action.op === '-'
      ) {
        return {
          ...state,
          entry: '-',
          lastOperator: null,
          lastOperand: null,
          lastOperandPercent: false,
        }
      }

      let tokens = state.tokens
      let entry = state.entry
      let justEvaluated = state.justEvaluated

      // Starting an operation straight after `=` continues from the result.
      if (justEvaluated) {
        tokens = [numberTokenFromValue(findLastNumber(tokens) ?? 0)]
        entry = null
        justEvaluated = false
      }

      if (entry !== null) {
        tokens = [...tokens, numberToken(entry)]
        entry = null
      }

      const last = tokens[tokens.length - 1]
      if (!last) return { ...state, justEvaluated: false }

      // A pending operator is replaced rather than stacked.
      const nextTokens =
        last.kind === 'operator'
          ? [...tokens.slice(0, -1), { kind: 'operator' as const, op: action.op }]
          : [...tokens, { kind: 'operator' as const, op: action.op }]

      return {
        ...state,
        tokens: nextTokens,
        entry: null,
        justEvaluated,
        lastOperator: action.op,
        lastOperand: null,
        lastOperandPercent: false,
      }
    }

    /* ------------------------------------------------------------------ */
    case 'percent': {
      if (state.error) return { ...createInitialState(), resetCount: state.resetCount }

      if (state.justEvaluated) {
        const value = findLastNumber(state.tokens) ?? 0
        return {
          ...state,
          tokens: [...state.tokens, { kind: 'percent' }],
          entry: null,
          justEvaluated: false,
          lastOperand: value,
          lastOperandPercent: true,
        }
      }

      if (state.entry !== null) {
        return {
          ...state,
          tokens: [...state.tokens, numberToken(state.entry), { kind: 'percent' }],
          entry: null,
          lastOperand: parseEntry(state.entry),
          lastOperandPercent: true,
        }
      }

      const last = state.tokens[state.tokens.length - 1]
      if (!last) return state
      if (last.kind === 'percent') return state
      if (last.kind === 'operator') return state

      return {
        ...state,
        tokens: [...state.tokens, { kind: 'percent' }],
        lastOperand: last.value,
        lastOperandPercent: true,
      }
    }

    /* ------------------------------------------------------------------ */
    case 'equals': {
      if (state.error) return { ...state, error: null }

      // Repeated equals: replay the last binary operation.
      if (state.justEvaluated) {
        if (state.lastOperator === null || state.lastOperand === null) {
          return state
        }
        const base = findLastNumber(state.tokens) ?? 0
        const operand = state.lastOperandPercent
          ? state.lastOperator === '+' || state.lastOperator === '-'
            ? (base * state.lastOperand) / 100
            : state.lastOperand / 100
          : state.lastOperand

        const outcome = evaluateSafe([
          numberTokenFromValue(base),
          { kind: 'operator', op: state.lastOperator },
          numberTokenFromValue(operand),
        ])
        if (!outcome.ok) {
          return { ...createInitialState(), error: outcome.code, resetCount: state.resetCount }
        }

        const operandText = state.lastOperandPercent
          ? `${formatNumber(state.lastOperand)}%`
          : formatNumber(state.lastOperand)

        return {
          ...state,
          tokens: [numberTokenFromValue(outcome.value)],
          entry: null,
          justEvaluated: true,
          lastExpression: `${formatNumber(base)} ${OPERATOR_SYMBOL[state.lastOperator]} ${operandText}`,
        }
      }

      const full =
        state.entry !== null ? [...state.tokens, numberToken(state.entry)] : state.tokens
      if (full.length === 0) return state

      const expression = stripTrailingOperator(full)
      const hasOperator = expression.some((token) => token.kind === 'operator')
      const hasPercent = expression.some((token) => token.kind === 'percent')

      if (!hasOperator && !hasPercent) {
        // A lone number: nothing to compute, but the result is committed.
        const value = findLastNumber(expression) ?? 0
        return {
          ...state,
          tokens: [numberTokenFromValue(value)],
          entry: null,
          justEvaluated: true,
          lastExpression: formatNumber(value),
          lastOperator: null,
          lastOperand: null,
          lastOperandPercent: false,
        }
      }

      const outcome = evaluateSafe(expression)
      if (!outcome.ok) {
        return { ...createInitialState(), error: outcome.code, resetCount: state.resetCount }
      }

      return {
        ...state,
        tokens: [numberTokenFromValue(outcome.value)],
        entry: null,
        justEvaluated: true,
        lastExpression: formatTokens(expression),
        lastOperator: state.lastOperator,
        lastOperand: state.lastOperand,
        lastOperandPercent: state.lastOperandPercent,
      }
    }

    /* ------------------------------------------------------------------ */
    case 'backspace': {
      if (state.error) return { ...state, error: null }
      if (state.justEvaluated) return { ...createInitialState(), resetCount: state.resetCount }

      if (state.entry !== null) {
        const entry = backspaceEntry(state.entry)
        return {
          ...state,
          entry,
          lastOperand: entry === null ? null : parseEntry(entry),
          lastOperandPercent: false,
        }
      }

      if (state.tokens.length === 0) return state

      return {
        ...state,
        tokens: state.tokens.slice(0, -1),
        lastOperand: null,
        lastOperandPercent: false,
      }
    }

    /* ------------------------------------------------------------------ */
    case 'clear-entry': {
      if (state.error) return { ...state, error: null }
      if (state.justEvaluated) return { ...createInitialState(), resetCount: state.resetCount }

      if (state.entry !== null) {
        return {
          ...state,
          entry: null,
          lastOperand: null,
          lastOperandPercent: false,
          resetCount: state.resetCount + 1,
        }
      }

      const last = state.tokens[state.tokens.length - 1]
      if (!last || last.kind !== 'number') return state

      return {
        ...state,
        tokens: state.tokens.slice(0, -1),
        lastOperand: null,
        lastOperandPercent: false,
        resetCount: state.resetCount + 1,
      }
    }

    /* ------------------------------------------------------------------ */
    case 'clear-all':
      return { ...createInitialState(), resetCount: state.resetCount + 1 }

    /* ------------------------------------------------------------------ */
    case 'set-entry': {
      // Reusing a history result: it becomes the current value, replacing any
      // number that is being typed.
      const base =
        state.justEvaluated || state.error
          ? { ...createInitialState(), resetCount: state.resetCount }
          : state
      return {
        ...base,
        entry: action.value,
        lastOperand: parseEntry(action.value),
        lastOperandPercent: false,
      }
    }

    /* ------------------------------------------------------------------ */
    case 'toggle-sign': {
      if (state.error) return { ...state, error: null }

      if (state.entry !== null) {
        // Toggling the sign off a lone "-" leaves nothing behind.
        const entry = state.entry === '-'
          ? null
          : state.entry.startsWith('-')
            ? state.entry.slice(1)
            : `-${state.entry}`
        return {
          ...state,
          entry,
          lastOperand: entry === null ? null : parseEntry(entry),
          lastOperandPercent: false,
        }
      }

      if (state.justEvaluated) {
        const value = findLastNumber(state.tokens) ?? 0
        return {
          ...state,
          tokens: [numberTokenFromValue(-value)],
          lastOperand: Math.abs(value),
          lastOperandPercent: false,
        }
      }

      for (let i = state.tokens.length - 1; i >= 0; i -= 1) {
        const token = state.tokens[i]
        if (token.kind === 'number') {
          const negated = numberTokenFromValue(-token.value)
          const tokens = [...state.tokens.slice(0, i), negated, ...state.tokens.slice(i + 1)]
          return { ...state, tokens, lastOperand: negated.value, lastOperandPercent: false }
        }
      }

      return { ...state, entry: '-' }
    }
  }
}

/**
 * The operator currently pending, or `null` when none is.
 *
 * The highlight disappears as soon as the user starts typing the next
 * operand, which is how a physical calculator behaves.
 */
export function getActiveOperator(state: CalculatorState): Operator | null {
  if (state.justEvaluated || state.entry !== null) return null
  const last = state.tokens[state.tokens.length - 1]
  return last && last.kind === 'operator' ? last.op : null
}

/** Everything the display needs, derived from the state. */
export interface DisplayState {
  /** The expression as text, e.g. `200 + 10%`. */
  expression: string
  /** The large value, e.g. `220`. */
  value: string
  /** Live result preview, e.g. `= 220`, or null when not applicable. */
  preview: string | null
  /** Error code when the expression cannot be evaluated. */
  error: CalculationErrorCode | null
}

/**
 * Derive what the display should show.
 *
 * The large value is always "where the calculation stands right now":
 *
 *  - while a number is being typed it is that number,
 *  - otherwise it is the live result of the expression so far,
 *  - falling back to the last operand when the expression is incomplete.
 *
 * The preview appears only when the live result differs from the large
 * value — in practice, while the user is still typing.
 */
export function deriveDisplay(state: CalculatorState): DisplayState {
  if (state.error) {
    return {
      expression: ERROR_MESSAGES[state.error],
      value: 'Error',
      preview: null,
      error: state.error,
    }
  }

  if (state.justEvaluated) {
    const value = findLastNumber(state.tokens) ?? 0
    return {
      expression: state.lastExpression ? `${state.lastExpression} =` : '',
      value: formatNumber(value),
      preview: null,
      error: null,
    }
  }

  const full = state.entry !== null ? [...state.tokens, numberToken(state.entry)] : state.tokens
  const expression = formatTokens(full, state.entry)
  const evaluable = stripTrailingOperator(full)

  const outcome = evaluateSafe(evaluable)
  if (!outcome.ok && outcome.code === 'divide-by-zero') {
    return { expression, value: 'Error', preview: null, error: 'divide-by-zero' }
  }

  let value: string
  let numericValue: number

  if (state.entry !== null) {
    numericValue = parseEntry(state.entry)
    value = formatEntry(state.entry)
  } else if (outcome.ok) {
    numericValue = outcome.value
    value = formatNumber(outcome.value)
  } else {
    const last = findLastNumber(evaluable)
    numericValue = last ?? 0
    value = last === null ? '0' : formatNumber(last)
  }

  let preview: string | null = null
  if (outcome.ok && outcome.value !== numericValue) {
    preview = `= ${formatNumber(outcome.value)}`
  }

  return { expression, value, preview, error: null }
}
