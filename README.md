<div align="center">

# Calculator

**A premium, tactile calculator that behaves like a carefully designed physical device.**

Dark-first · Offline-capable · Installable · Correct to the last digit

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?style=flat-square&logo=vite&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-8A7BD1?style=flat-square)](LICENSE)

</div>

<div align="center">

| Dark | Light | Phone |
| :---: | :---: | :---: |
| ![Dark theme](docs/preview-dark.png) | ![Light theme](docs/preview-light.png) | ![Mobile](docs/preview-mobile.png) |

</div>

---

## Table of contents

- [What it is](#what-it-is)
- [Features](#features)
- [Quick start](#quick-start)
- [The calculation engine](#the-calculation-engine)
- [The Python reference engine](#the-python-reference-engine)
- [Haptics — what is real and what is not](#haptics--what-is-real-and-what-is-not)
- [Design system](#design-system)
- [Responsive behaviour](#responsive-behaviour)
- [Accessibility](#accessibility)
- [Project structure](#project-structure)
- [Verification](#verification)
- [Contributing](#contributing)
- [License](#license)

---

## What it is

A single-screen calculator built around three ideas:

1. **Correctness before cleverness.** The calculation engine is a pure, token-based state machine with an explicit grammar — never `eval()`, never regular-expression arithmetic. It is cross-validated against an independent Python reference engine.
2. **Tactility.** Every key answers immediately: a press-scale response, a distinct haptic pattern per interaction class, an optional synthesised click, and a deliberate visual state for the pending operator.
3. **Restraint.** One accent colour, one typeface family for text and another for numerals, no gradients, no glass, no glow. The interface gets out of the way of the arithmetic.

---

## Features

| Area | Behaviour |
| --- | --- |
| **Display** | Small monospace expression line, large tabular-numeral value, live `=` preview, copy-to-clipboard with confirmation. The value scales itself down using container-query units, so long numbers never overflow. |
| **Keypad** | 21 keys in a five-column grid. `0` spans two columns; `=` spans four rows as a full-height signal-orange bar. The pending operator lights up. |
| **Arithmetic** | `+ − × ÷` with correct precedence, decimals, negatives, percentages, repeated `=`, backspace, clear entry, clear all, division-by-zero handling. |
| **History** | The last 50 calculations, stored on the device. Tap an entry to reuse its result; delete one entry or clear the lot. |
| **Keyboard** | `0`–`9`, `+ - * /`, `.`, `Enter`/`=` (equals), `Backspace` (delete), `Escape`/`Delete` (clear), `C` (clear entry), `%`, `~`/`n` (sign). |
| **Feedback** | Vibration patterns for digits / operators / equals / clear / error, plus an optional Web Audio click. Both are independently switchable. |
| **Appearance** | Dark (default), light, or follow the system. Theme transitions are colour-only. |
| **Motion** | Every animation is under 300 ms, transform/opacity only, and fully disabled by `prefers-reduced-motion` or the in-app switch. |
| **PWA** | Installable, works offline via a precaching service worker, self-hosted fonts. Nothing leaves the device. |

---

## Quick start

**Requirements:** Node.js ≥ 20 and Python ≥ 3.10.

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev            # → http://localhost:5173
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc -b` — full type check |
| `npm run lint` | `oxlint` — lint the source |
| `npm run test:python` | pytest — unit, fixture and differential tests |
| `npm run test:ui` | Playwright — 7 viewports, full interaction pass |
| `npm run test:pwa` | Playwright — manifest, service worker, offline |
| `npm run verify:fixtures` | Run the frontend engine against the shared fixture |
| `npm run icons` | Regenerate the PWA icons |

### Python tooling

```bash
python -m pip install -r python/requirements.txt
npm run test:python      # or: python -m pytest python -v
```

The UI and PWA checks drive a real browser and expect a server to be running:

```bash
npm run dev              # then, in another shell: npm run test:ui
npm run preview          # then, in another shell: npm run test:pwa
```

---

## The calculation engine

### Architecture

```
src/engine/
  formatter.ts          number cleaning + display formatting
  expressionParser.ts   recursive-descent parser / evaluator
  calculatorEngine.ts   the pure reducer + display derivation
  keyDefinitions.ts     keypad layout, labels and feedback mapping
```

The engine has no React, no DOM and no timers. Every transition is
`(state, action) -> state`, which is why it can be executed directly by Node
for the differential tests.

### Token model

An expression is a list of tokens, never a string:

```ts
type Token =
  | { kind: 'number'; value: number; raw: string }
  | { kind: 'operator'; op: '+' | '-' | '*' | '/' }
  | { kind: 'percent' }
```

The *entry* — the raw text currently being typed — is kept separate from the
committed token list. That distinction is what makes `0.50` echo back as
`0.50`, makes backspace predictable, and makes a trailing operator a normal
state rather than a special case.

### Percentage semantics

`%` is a postfix operator whose meaning depends on the operator in front of
its operand:

| Expression | Meaning | Result |
| --- | --- | --- |
| `200 + 10%` | 10 % **of the accumulated value** | `220` |
| `200 − 10%` | 10 % of the accumulated value | `180` |
| `200 × 10%` | 10 % of 100 | `20` |
| `10%` | 10 % of 100 | `0.1` |

In the parser this is the `percentBase` / `percentBaseValue` pair threaded
through `parseExpression` → `parseTerm` → `parseFactor`. The base applies only
to the **first** factor of a term, so `200 + 3 × 10%` resolves the `10%`
against 100 (it follows `×`), not against 200.

### Repeated equals

`=` replays the last binary operation:

| Keys | Result |
| --- | --- |
| `2 + 3 =` | `5` |
| `2 + 3 = =` | `8` |
| `1 + 2 × 3 = =` | `21` — the *multiplication* repeats, because `×` was the last operator pressed |
| `200 + 10% = =` | `242` — the percentage is re-scaled against the new base |

### Numeric precision

The browser computes with IEEE-754 doubles. Two rules keep the display clean:

1. **Integers are never rounded.** Every integer a double can represent exactly stays exact.
2. **Non-integers are cleaned to 12 significant digits**, which removes binary noise: `0.1 + 0.2` displays as `0.3`, `1 ÷ 3` as `0.333333333333`.

Magnitudes outside `[1e-6, 1e21)` switch to exponential notation (`1e−7`,
`1e+21`); everything else is grouped with thousands separators and uses a
typographic minus sign (`−`).

### Division by zero

`5 ÷ 0` reports **Cannot divide by zero** immediately, both while typing and
on `=`. The expression is discarded and the next key press starts a fresh
calculation.

---

## The Python reference engine

`python/reference_engine.py` is an independent implementation of the same
specification using `decimal.Decimal` instead of doubles, so precision
sensitive cases are checked against exact arithmetic.

```
python/
  reference_engine.py        the engine (Decimal-based)
  test_reference_engine.py   pytest suite
  fixtures/calculator_cases.json   the shared behaviour contract
  requirements.txt
```

### The shared fixture

`python/fixtures/calculator_cases.json` holds ~40 cases, each a list of key
presses and the expected display. Both engines are driven by it:

```json
{
  "id": "percent-additive",
  "keys": ["2", "0", "0", "+", "1", "0", "%", "="],
  "expected": { "expression": "200 + 10% =", "value": "220", "preview": null, "error": null }
}
```

Because the key vocabulary (`0`–`9`, `+ - × ÷ . % ± AC C ⌫ =`) matches the real
keypad, the fixture exercises the shipping code path, not a parallel
implementation.

### Three layers of testing

| Layer | What it proves |
| --- | --- |
| Unit tests | The arithmetic and formatting rules in isolation. |
| Fixture tests | The Python engine matches every expected display. |
| Differential tests | The **real frontend engine** matches every expected display, *and* matches the Python engine case by case. |

The differential test runs the TypeScript engine directly in Node using its
built-in type stripping (Node ≥ 22.18) — no extra tooling:

```bash
npm run verify:fixtures    # prints the frontend engine's results as JSON
```

---

## Haptics — what is real and what is not

The app uses the **Vibration API** (`navigator.vibrate`).

**Honest limitations:**

- The API accepts a duration in milliseconds, or an array of durations and
  pauses. It has **no intensity control** — the browser decides how strong a
  pulse feels. Any claim of controlling vibration strength on the web is
  inaccurate.
- **iOS Safari does not implement the Vibration API at all.** On iPhone and
  iPad the app falls back to the visual press feedback and, if enabled, the
  sound cue. The settings panel states this when support is missing.
- Some browsers define `navigator.vibrate` but throw when it is called
  outside a user gesture. The implementation probes conservatively and
  swallows failures.
- Haptics are fired synchronously inside the user gesture, after the
  calculation has already been performed — a vibration can never delay a
  result.

### Patterns

| Interaction | Pattern (ms) |
| --- | --- |
| Digit, decimal point | `8` |
| Operator, percentage, sign | `14` |
| Equals | `[14, 40, 16]` — a double tap that reads as "confirmed" |
| Clear / backspace | `[10, 35, 10]` |
| Error | `[45, 60, 45]` |

The optional sound is synthesised with the Web Audio API — a short pitched
blip plus a 4 ms band-passed noise transient — so it works offline and needs
no assets.

---

## Design system

### Colour

One accent, used once. Everything else is a neutral surface.

| Token | Dark | Light |
| --- | --- | --- |
| `--pc-bg` | `#0a0b0d` | `#edeae4` |
| `--pc-surface` | `#16191d` | `#fbf9f5` |
| `--pc-key` | `#242830` | `#ffffff` |
| `--pc-key-fn` | `#1b1e23` | `#e7e3da` |
| `--pc-accent` | `#ff7a3d` | `#f2672e` |
| `--pc-accent-contrast` | `#0a0b0d` | `#14161a` |
| `--pc-text` | `#eef1f5` | `#14161a` |
| `--pc-text-muted` | `#8b929c` | `#5a6069` |
| `--pc-danger` | `#ff6b60` | `#d1341f` |

All text/background pairs meet WCAG AA (≥ 4.5:1) for body text and ≥ 3:1 for
large text and UI boundaries.

### Typography

- **Inter Variable** — interface text and the large value, with
  `font-variant-numeric: tabular-nums` so digits never reflow.
- **JetBrains Mono Variable** — the expression line and the wordmark. The
  mono/sans contrast is deliberate: the mono line is what you *typed*, the
  sans figure is what you *got*.

Both are self-hosted through `@fontsource-variable`, so they work offline and
no third-party request is ever made.

### Motion

| Element | Duration | Easing |
| --- | --- | --- |
| Key press | 120 ms | `cubic-bezier(0.23, 1, 0.32, 1)` |
| Copy confirmation | 220 ms | same |
| Panel / drawer | 220–260 ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Theme crossfade | 260 ms | colour properties only |

Press feedback is a CSS transition on `transform` and `background-color` only
— no layout properties, so nothing reflows and the compositor keeps the
animation on the GPU. Digit entry is deliberately **not** animated: it happens
hundreds of times a day, and an animation there reads as lag.

---

## Responsive behaviour

| Range | Layout |
| --- | --- |
| `< 768px` | Full-height device surface. The keypad absorbs the leftover height; the display keeps a bottom-aligned value. Safe-area insets are honoured; the page never scrolls. |
| `≥ 768px` | The calculator takes a deliberate fixed size (412 px wide) and is centred — never stretched. A keyboard-shortcut hint appears beneath it. |
| `≥ 768px` panels | History and settings open as a right-hand drawer. |
| `< 768px` panels | History and settings open as a bottom sheet. |

Additional mobile details: `100dvh` app shell, `overscroll-behavior: none`,
`-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`,
`user-select: none` on controls only, `viewport-fit=cover`, and a
`theme-color` per colour scheme.

---

## Accessibility

- Every control is a real `<button>` with an accessible name.
- The display is an `<output>` with `aria-live="polite"`, so the current value
  is announced as it changes.
- Touch targets are verified to be **≥ 44 × 44 CSS px** in the automated UI
  checks — including the settings switches, whose visible track is 44 × 26 px
  but whose hit area is 62 × 44 px.
- Visible focus rings (`2px` outline, offset) — focus is never removed.
- The keypad is fully keyboard-operable; `Tab` reaches every key.
- `prefers-reduced-motion` is respected, and can be forced on from settings.
- The pending operator is exposed with `aria-pressed`.
- Colour is never the only signal: the operator state, the error state and
  the copy confirmation all carry text or shape as well.

---

## Project structure

```
.
├── index.html
├── vite.config.ts               Vite + Tailwind v4 + vite-plugin-pwa
├── public/                      icons, favicon
├── docs/                        screenshots used by this README
├── scripts/
│   ├── generate_icons.py        renders the PWA icons with Pillow
│   ├── verify-fixtures.mjs      runs the frontend engine against the fixture
│   ├── ui_check.py              Playwright UI verification
│   └── pwa_check.py             Playwright PWA + offline verification
├── python/
│   ├── reference_engine.py      Decimal-based reference implementation
│   ├── test_reference_engine.py pytest suite (unit + fixture + differential)
│   ├── fixtures/calculator_cases.json
│   └── requirements.txt
└── src/
    ├── App.tsx                  application shell
    ├── main.tsx
    ├── components/
    │   ├── Calculator/           Calculator, Display, Keypad, CalculatorButton
    │   ├── History/HistoryPanel.tsx
    │   ├── Settings/            SettingsPanel, Toggle
    │   ├── TopBar.tsx
    │   └── ui/                  IconButton, Sheet
    ├── engine/                  the pure calculator core
    │   ├── calculatorEngine.ts  reducer + display derivation
    │   ├── expressionParser.ts  parser / evaluator
    │   ├── formatter.ts         number cleaning + formatting
    │   └── keyDefinitions.ts    keypad layout, labels, feedback mapping
    ├── hooks/                   useCalculator, useHaptics, useSound,
    │                            useKeyboard, useHistory, useMediaQuery,
    │                            settingsContext, SettingsProvider
    ├── styles/                  globals.css, tokens.css
    ├── types/calculator.ts
    └── utils/                   storage, cn
```

> The `src/engine/` and `src/types/` modules import with explicit `.ts`
> extensions so that Node can execute the engine directly with its built-in
> type stripping. That is what makes the differential test possible without
> adding a test runner or a bundler step.

---

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean, no errors |
| Lint | `npm run lint` | clean, no warnings |
| Python suite | `npm run test:python` | **163 passed** |
| Frontend engine vs. fixture | `npm run verify:fixtures` | matches the fixture exactly |
| Build | `npm run build` | succeeds; the service worker precaches the built assets |
| UI + interaction | `npm run test:ui` | all checks pass at 7 viewports |
| PWA + offline | `npm run test:pwa` | manifest, icons, service worker and offline all pass |

`scripts/ui_check.py` drives a real Chromium browser and verifies: no console
errors or warnings, no horizontal overflow, ≥ 44 px touch targets, a fully
visible keypad, the calculation flow (percentages, repeated equals,
division-by-zero, recovery), long-value overflow, the full keyboard map, theme
switching, history record/reuse, every settings control, switch knob geometry
(inside the track, exact 3 px insets, animated rather than jumping),
accessible names, live-region announcements, keyboard reachability, and Escape
dismissing an open panel — at 360 px, 390 px, 393 px, 430 px, 834 px, 1440 px
and 1920 px.

`scripts/pwa_check.py` runs against the production build and verifies the
manifest (name, icons, maskable icon, every icon resolving), service worker
registration, and that the app still renders *and calculates* with the network
switched off.

### Not verified

The haptics and the safe-area insets were verified by code inspection and
feature detection only. **Real-device testing on a physical phone is still
required** to confirm the feel of the vibration patterns and the exact inset
behaviour on notched devices — emulation cannot reproduce either.

---

## Contributing

Issues and pull requests are welcome.

1. **Keep the engine pure.** `src/engine/` must stay free of React, the DOM
   and timers — that is what makes the differential tests possible.
2. **Add a fixture case** for any behaviour change and run
   `npm run test:python`. The frontend and the Python reference engine must
   agree.
3. **Run the full check** before opening a pull request:
   `npm run typecheck && npm run lint && npm run test:python && npm run build`.
4. **Keep motion restrained.** Animations belong to state changes, not to
   decoration, and must respect `prefers-reduced-motion`.

---

## License

Released under the [MIT License](LICENSE).

---

<div align="center">
Made with care — every digit checked.
</div>
