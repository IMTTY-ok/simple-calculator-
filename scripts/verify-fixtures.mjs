#!/usr/bin/env node
/**
 * Run the shared fixture file through the *real* frontend engine.
 *
 * The engine is written in TypeScript, but it contains no React and no DOM
 * dependencies, so Node can execute it directly using its built-in type
 * stripping (Node >= 22.18 / 23.6). No extra tooling required.
 *
 * Output: a JSON object mapping case id -> { expression, value, preview, error }.
 *
 *   node scripts/verify-fixtures.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  calculatorReducer,
  createInitialState,
  deriveDisplay,
} from '../src/engine/calculatorEngine.ts'
import { KEY_SEQUENCE_MAP } from '../src/engine/keyDefinitions.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = resolve(here, '../python/fixtures/calculator_cases.json')
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))

const results = {}

for (const testCase of fixture.cases) {
  let state = createInitialState()

  for (const key of testCase.keys) {
    const definition = KEY_SEQUENCE_MAP[key]
    if (!definition) {
      throw new Error(`Unknown key "${key}" in case "${testCase.id}"`)
    }
    state = calculatorReducer(state, definition.action)
  }

  const display = deriveDisplay(state)
  results[testCase.id] = {
    expression: display.expression,
    value: display.value,
    preview: display.preview,
    error: display.error,
  }
}

process.stdout.write(JSON.stringify(results, null, 2))
