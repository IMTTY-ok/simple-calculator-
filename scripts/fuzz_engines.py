"""Randomised differential test: TypeScript engine vs Python reference engine.

Generates random key sequences, runs them through both engines and compares
the resulting display. Any divergence is a bug in one of the two.

    python scripts/fuzz_engines.py --cases 4000
"""

from __future__ import annotations

import argparse
import json
import pathlib
import random
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python"))

from reference_engine import run_key_sequence  # noqa: E402

KEYS = list("0123456789") + ["+", "-", "×", "÷", ".", "%", "±", "AC", "C", "⌫", "="]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", type=int, default=3000)
    parser.add_argument("--seed", type=int, default=20261104)
    parser.add_argument("--max-length", type=int, default=14)
    args = parser.parse_args()

    rng = random.Random(args.seed)

    sequences = []
    for _ in range(args.cases):
        length = rng.randint(1, args.max_length)
        sequences.append([rng.choice(KEYS) for _ in range(length)])

    # Run the TypeScript engine over the same sequences.
    script = ROOT / "scripts" / "_fuzz_engine.mjs"
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

    sequences_path = ROOT / ".artifacts" / "fuzz-sequences.json"
    sequences_path.parent.mkdir(parents=True, exist_ok=True)
    sequences_path.write_text(json.dumps(sequences), encoding="utf-8")

    result = subprocess.run(
        ["node", str(script), str(sequences_path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=600,
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
            if mismatches <= 10:
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
