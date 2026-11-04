/**
 * Number formatting.
 *
 * The calculator must never show floating-point noise (`0.1 + 0.2` must read
 * `0.3`, not `0.30000000000000004`) and must stay readable for very large or
 * very small magnitudes. Two ideas do the heavy lifting:
 *
 *  1. `cleanNumber` rounds any non-integer to 12 significant digits, which is
 *     comfortably below the precision of IEEE-754 doubles but far above the
 *     precision a human cares about. Integers are left untouched so that
 *     large integer arithmetic stays exact.
 *  2. `formatNumber` groups the integer part and falls back to exponential
 *     notation outside the range that decimal notation can render legibly.
 */

import type { Operator, Token } from '../types/calculator.ts'

/** Significant digits retained when cleaning a computed value. */
export const MAX_SIGNIFICANT_DIGITS = 12

/** Values at or above this magnitude use exponential notation. */
const EXPONENT_UPPER_BOUND = 1e21
/** Values below this magnitude (and above zero) use exponential notation. */
const EXPONENT_LOWER_BOUND = 1e-6

/** Glyphs used for operators in the expression display. */
export const OPERATOR_SYMBOL: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
}

/** Typographic minus sign (U+2212) used everywhere numbers are displayed. */
const MINUS = '−'

/**
 * Remove floating-point noise from a computed value.
 *
 * Integers are returned unchanged — doubles represent every integer below
 * 2^53 exactly, so rounding them would *introduce* an error rather than
 * remove one.
 */
export function cleanNumber(value: number): number {
  if (!Number.isFinite(value)) return value
  if (value === 0) return 0
  if (Number.isInteger(value)) return value
  const rounded = Number(value.toPrecision(MAX_SIGNIFICANT_DIGITS))
  return Object.is(rounded, -0) ? 0 : rounded
}

/** Insert thousands separators into a run of digits. */
function groupDigits(digits: string): string {
  if (digits.length <= 3) return digits
  const head = digits.length % 3 === 0 ? 3 : digits.length % 3
  const groups = [digits.slice(0, head)]
  for (let i = head; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3))
  return groups.join(',')
}

/** Render a value in exponential notation, e.g. `1.23457e+25`. */
function formatExponential(value: number): string {
  const [mantissa, exponent] = value.toExponential(6).split('e')
  const trimmed = mantissa.replace(/\.?0+$/, '')
  const sign = exponent.startsWith('-') ? MINUS : '+'
  return `${trimmed}e${sign}${exponent.replace(/^[+-]/, '')}`
}

/**
 * Format a numeric value for the display.
 *
 * - Integers are grouped with thousands separators.
 * - Decimals keep every significant digit the engine produced.
 * - Magnitudes outside `[1e-6, 1e21)` switch to exponential notation so the
 *   number never overflows the display.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  if (value === 0) return '0'

  const magnitude = Math.abs(value)
  if (magnitude >= EXPONENT_UPPER_BOUND || magnitude < EXPONENT_LOWER_BOUND) {
    return formatExponential(value)
  }

  const cleaned = cleanNumber(value)
  const negative = cleaned < 0
  const [integerPart, fractionPart] = Math.abs(cleaned).toString().split('.')
  const grouped = groupDigits(integerPart)
  return `${negative ? MINUS : ''}${grouped}${fractionPart ? `.${fractionPart}` : ''}`
}

/**
 * Format the raw text the user is currently typing.
 *
 * The entry keeps the user's own notation (`0.50` stays `0.50`) but the
 * integer part is grouped the same way results are.
 */
export function formatEntry(raw: string): string {
  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw
  if (body === '') return negative ? MINUS : '0'

  const dotIndex = body.indexOf('.')
  const integerRaw = dotIndex === -1 ? body : body.slice(0, dotIndex)
  const fraction = dotIndex === -1 ? undefined : body.slice(dotIndex + 1)

  const trimmed = integerRaw.replace(/^0+(?=\d)/, '')
  const integerPart = trimmed === '' ? '0' : trimmed
  const grouped = groupDigits(integerPart)

  return `${negative ? MINUS : ''}${grouped}${fraction !== undefined ? `.${fraction}` : ''}`
}

/**
 * Render a token stream as a readable expression, e.g. `200 + 10%`.
 *
 * A `%` binds to the number in front of it, so it is never separated by a
 * space.
 */
export function formatTokens(tokens: Token[]): string {
  let result = ''
  for (const token of tokens) {
    if (token.kind === 'percent') {
      result += '%'
      continue
    }
    const text =
      token.kind === 'number' ? formatNumber(token.value) : OPERATOR_SYMBOL[token.op]
    result += result === '' ? text : ` ${text}`
  }
  return result
}

/** Parse raw user input into a number, falling back to `0`. */
export function parseEntry(raw: string): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 0
  return cleanNumber(parsed)
}
