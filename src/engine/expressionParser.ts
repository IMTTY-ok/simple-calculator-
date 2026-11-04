/**
 * Expression parser and evaluator.
 *
 * A recursive-descent parser over the token stream. No `eval()`, no
 * `Function()`, no regular-expression arithmetic — only explicit grammar.
 *
 * Grammar (precedence climbing, lowest to highest):
 *
 *   expression := term (('+' | '-') term)*
 *   term       := factor (('*' | '/') factor)*
 *   factor     := number ('%')*
 *
 * ---------------------------------------------------------------------------
 * Percentage semantics
 * ---------------------------------------------------------------------------
 * `%` is a postfix operator whose meaning depends on the operator that
 * precedes its operand:
 *
 *   200 + 10%  →  200 + (10% of 200)          = 220
 *   200 - 10%  →  200 - (10% of 200)          = 180
 *   200 × 10%  →  200 × (10 / 100)            = 20
 *   10%        →  10 / 100                   = 0.1
 *
 * In other words: after `+` or `-` a percentage is *relative to the value
 * accumulated so far*; after `×` or `÷` (or on its own) it is *relative to
 * 100*. This is the behaviour of every mainstream calculator, and it is the
 * behaviour the Python reference engine reproduces.
 */

import { cleanNumber } from './formatter.ts'
import type { CalculationErrorCode, Operator, Token } from '../types/calculator.ts'

/** Reasons an expression can fail to evaluate. */
export type { CalculationErrorCode }

/** Error thrown while evaluating an expression. */
export class CalculationError extends Error {
  readonly code: CalculationErrorCode

  constructor(code: CalculationErrorCode) {
    super(code)
    this.name = 'CalculationError'
    this.code = code
  }
}

/** Apply a binary operator. */
export function applyOperator(op: Operator, left: number, right: number): number {
  switch (op) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      return left / right
  }
}

/**
 * Recursive-descent evaluator.
 *
 * `percentBase` / `percentBaseValue` carry the context needed to resolve a
 * percentage that follows `+` or `-`: the value accumulated to the left of
 * that operator.
 */
class Parser {
  private index = 0
  private readonly tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): number {
    const value = this.parseExpression()
    if (this.index < this.tokens.length) {
      throw new CalculationError('invalid')
    }
    return value
  }

  private parseExpression(): number {
    let left = this.parseTerm(null, null)

    while (this.peekOperator('+', '-')) {
      const op = (this.tokens[this.index] as { kind: 'operator'; op: Operator }).op
      this.index += 1
      const right = this.parseTerm(op, left)
      left = applyOperator(op, left, right)
    }

    return left
  }

  private parseTerm(percentBase: Operator | null, percentBaseValue: number | null): number {
    // The percentage base only applies to the *first* factor of a term:
    // in `200 + 3 × 10%` the `10%` follows `×`, so it is relative to 100.
    let left = this.parseFactor(percentBase, percentBaseValue)

    while (this.peekOperator('*', '/')) {
      const op = (this.tokens[this.index] as { kind: 'operator'; op: Operator }).op
      this.index += 1
      const right = this.parseFactor(null, null)
      if (op === '/' && right === 0) {
        throw new CalculationError('divide-by-zero')
      }
      left = applyOperator(op, left, right)
    }

    return left
  }

  private parseFactor(percentBase: Operator | null, percentBaseValue: number | null): number {
    const token = this.tokens[this.index]
    if (!token || token.kind !== 'number') {
      throw new CalculationError('invalid')
    }
    this.index += 1

    let value = token.value
    while (this.tokens[this.index]?.kind === 'percent') {
      this.index += 1
      if (percentBase === '+' || percentBase === '-') {
        // Relative to the accumulated value: `200 + 10%` → 200 + 20.
        value = (percentBaseValue ?? 0) * (value / 100)
      } else {
        // Relative to 100: `200 × 10%` → 200 × 0.1.
        value = value / 100
      }
      // A second `%` would no longer see the original base.
      percentBase = null
      percentBaseValue = null
    }

    return value
  }

  private peekOperator(...ops: Operator[]): boolean {
    const token = this.tokens[this.index]
    return !!token && token.kind === 'operator' && ops.includes(token.op)
  }
}

/**
 * Evaluate a token stream.
 *
 * @throws {CalculationError} when the expression is malformed or divides by zero.
 */
export function evaluateTokens(tokens: Token[]): number {
  if (tokens.length === 0) {
    throw new CalculationError('invalid')
  }
  return cleanNumber(new Parser(tokens).parse())
}

/**
 * Remove a single trailing operator.
 *
 * `2 + 3 +` becomes `2 + 3`, which is what a user means when they hit `=`
 * straight after an operator.
 */
export function stripTrailingOperator(tokens: Token[]): Token[] {
  const last = tokens[tokens.length - 1]
  if (last && last.kind === 'operator') {
    return tokens.slice(0, -1)
  }
  return tokens
}
