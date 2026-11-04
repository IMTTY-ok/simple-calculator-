"""Systematic parity check for every action taken from an error state.

The random fuzz only reaches "error + action" combinations occasionally. This
script walks *every* action from *every* kind of error and compares the two
engines, which is where the last two divergences were found.

    python scripts/error_path_parity.py
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python"))

from reference_engine import run_key_sequence  # noqa: E402

#: Prefixes that put the calculator into an error state.
ERROR_PREFIXES = [
    ["5", "÷", "0", "="],          # division by zero
    ["5", "÷", "0"],               # division by zero, live
    ["2", "+", "×"],               # invalid expression
    ["2", "+", "×", "3", "="],     # invalid expression, on equals
]

#: The keys that can follow.
FOLLOW_UPS = list("0123456789") + ["+", "-", "×", "÷", ".", "%", "±", "AC", "C", "⌫", "="]


def main() -> int:
    sequences: list[list[str]] = []
    for prefix in ERROR_PREFIXES:
        for follow in FOLLOW_UPS:
            sequences.append(prefix + [follow])
            sequences.append(prefix + [follow, follow])

    script = ROOT / "scripts" / "_parity_engine.mjs"
    script.write_text(
        """
import { readFileSync } from 'node:fs'
import { calculatorReducer, createInitialState, deriveDisplay } from '../src/engine/calculatorEngine.ts'
import { KEY_SEQUENCE_MAP } from '../src/engine/keyDefinitions.ts'

const sequences = JSON.parse(readFileSync(process.argv[2], 'utf-8'))
const results = sequences.map((keys) => {
  let state = createInitialState()
  for (const key of keys) {
    state = calculatorReducer(state, KEY_SEQUENCE_MAP[key].action)
  }
  const display = deriveDisplay(state)
  return [display.expression, display.value, display.preview, display.error]
})
process.stdout.write(JSON.stringify(results))
""",
        encoding="utf-8",
    )

    sequences_path = ROOT / ".artifacts" / "parity-sequences.json"
    sequences_path.parent.mkdir(parents=True, exist_ok=True)
    sequences_path.write_text(json.dumps(sequences), encoding="utf-8")

    result = subprocess.run(
        ["node", str(script), str(sequences_path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=300,
    )
    if result.returncode != 0:
        print(result.stderr)
        return 1

    frontend = json.loads(result.stdout)

    mismatches = 0
    for keys, ts in zip(sequences, frontend):
        py = run_key_sequence(keys)
        ts_tuple = [ts[0], ts[1], ts[2], ts[3]]
        py_tuple = [py["expression"], py["value"], py["preview"], py["error"]]
        if ts_tuple != py_tuple:
            mismatches += 1
            if mismatches <= 12:
                print("MISMATCH")
                print("  keys :", " ".join(keys))
                print("  ts   :", ts_tuple)
                print("  py   :", py_tuple)

    print()
    print(f"sequences tested : {len(sequences)}")
    print(f"mismatches       : {mismatches}")

    script.unlink(missing_ok=True)
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
