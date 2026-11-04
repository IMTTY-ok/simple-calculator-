"""Test suite for the Calculator reference engine.

Three layers of verification:

1. **Unit tests** — the arithmetic rules in isolation.
2. **Fixture tests** — every case in ``fixtures/calculator_cases.json`` is run
   through the Python reference engine and compared with the expected display.
3. **Differential tests** — the very same fixture is run through the real
   frontend engine (TypeScript, executed by Node's built-in type stripping)
   and the two results are compared case by case. Any divergence between the
   double-precision frontend and the decimal reference shows up here.

Run with::

    python -m pytest python -v
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from reference_engine import (  # noqa: E402
    CalculationError,
    CalculatorAction,
    CalculatorState,
    Operator,
    Token,
    apply_operator,
    calculator_reducer,
    clean_number,
    derive_display,
    evaluate_tokens,
    format_entry,
    format_number,
    format_tokens,
    parse_entry,
    run_key_sequence,
)

PYTHON_DIR = Path(__file__).parent
PROJECT_ROOT = PYTHON_DIR.parent
FIXTURE_PATH = PYTHON_DIR / "fixtures" / "calculator_cases.json"
NODE_SCRIPT = PROJECT_ROOT / "scripts" / "verify-fixtures.mjs"

#: The shared behaviour contract, loaded once so it can drive parametrisation.
CASES: list[dict] = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["cases"]

#: Glyphs used in the expected displays.
MINUS = "\u2212"
TIMES = "\u00d7"
DIVIDE = "\u00f7"
PERCENT = "%"
SIGN = "\u00b1"
BACKSPACE = "\u232b"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def node_results() -> dict[str, dict]:
    """The frontend engine's results for every fixture case.

    Skipped when Node is unavailable or too old to strip TypeScript types.
    """
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is not installed")

    completed = subprocess.run(
        [node, str(NODE_SCRIPT)],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
    )
    if completed.returncode != 0:
        pytest.skip(f"frontend engine could not be executed: {completed.stderr.strip()}")

    return json.loads(completed.stdout)


# ---------------------------------------------------------------------------
# 1. Unit tests — arithmetic rules
# ---------------------------------------------------------------------------


def test_addition():
    assert apply_operator(Operator.ADD, Decimal(2), Decimal(3)) == Decimal(5)


def test_subtraction():
    assert apply_operator(Operator.SUB, Decimal(9), Decimal(4)) == Decimal(5)


def test_multiplication():
    assert apply_operator(Operator.MUL, Decimal(6), Decimal(7)) == Decimal(42)


def test_division():
    assert apply_operator(Operator.DIV, Decimal(9), Decimal(2)) == Decimal("4.5")


def test_division_by_zero_raises():
    with pytest.raises(CalculationError) as excinfo:
        apply_operator(Operator.DIV, Decimal(1), Decimal(0))
    assert excinfo.value.code == "divide-by-zero"


def test_decimal_arithmetic_is_exact():
    assert apply_operator(Operator.ADD, Decimal("0.1"), Decimal("0.2")) == Decimal("0.3")


def test_operator_precedence():
    tokens = [
        Token.number("2"),
        Token.operator(Operator.ADD),
        Token.number("3"),
        Token.operator(Operator.MUL),
        Token.number("4"),
    ]
    assert evaluate_tokens(tokens) == Decimal(14)


def test_percent_is_relative_to_the_accumulator():
    tokens = [
        Token.number("200"),
        Token.operator(Operator.ADD),
        Token.number("10"),
        Token.percent(),
    ]
    assert evaluate_tokens(tokens) == Decimal(220)


def test_percent_after_multiplication_is_relative_to_one_hundred():
    tokens = [
        Token.number("200"),
        Token.operator(Operator.MUL),
        Token.number("10"),
        Token.percent(),
    ]
    assert evaluate_tokens(tokens) == Decimal(20)


def test_percent_alone_is_relative_to_one_hundred():
    assert evaluate_tokens([Token.number("50"), Token.percent()]) == Decimal("0.5")


def test_percent_after_subtraction():
    tokens = [
        Token.number("200"),
        Token.operator(Operator.SUB),
        Token.number("10"),
        Token.percent(),
    ]
    assert evaluate_tokens(tokens) == Decimal(180)


# ---------------------------------------------------------------------------
# 2. Unit tests — formatting
# ---------------------------------------------------------------------------


def test_format_number_groups_thousands():
    assert format_number(Decimal(12345678)) == "12,345,678"


def test_format_number_uses_typographic_minus():
    assert format_number(Decimal(-3)) == MINUS + "3"


def test_format_number_removes_float_noise():
    assert format_number(Decimal("0.30000000000000004")) == "0.3"


def test_format_number_keeps_integers_exact():
    assert format_number(Decimal("123456789012345")) == "123,456,789,012,345"


def test_format_number_uses_exponential_for_very_small_values():
    assert format_number(Decimal("0.0000001")) == "1e" + MINUS + "7"


def test_format_number_uses_exponential_for_very_large_values():
    assert format_number(Decimal("1e21")) == "1e+21"


def test_format_entry_preserves_the_users_notation():
    assert format_entry("0.50") == "0.50"
    assert format_entry("1234") == "1,234"
    assert format_entry("-5") == MINUS + "5"


def test_format_tokens_binds_percent_to_its_number():
    tokens = [
        Token.number("200"),
        Token.operator(Operator.ADD),
        Token.number("10"),
        Token.percent(),
    ]
    assert format_tokens(tokens) == "200 + 10" + PERCENT


def test_clean_number_rounds_to_twelve_significant_digits():
    # The cleanup returns the nearest double of the 12-digit rounding, which
    # is exactly what the browser's `Number(value.toPrecision(12))` produces.
    cleaned = clean_number(Decimal(1) / Decimal(3))
    assert format_number(cleaned) == "0.333333333333"
    assert cleaned == Decimal(float(cleaned))


def test_parse_entry_matches_the_browser_double():
    # 0.1 and 0.2 are not exactly representable; the engine must start from
    # the same doubles the browser does, so the sum displays as 0.3.
    assert parse_entry("0.1") == Decimal(float(Decimal("0.1")))
    assert format_number(parse_entry("0.1") + parse_entry("0.2")) == "0.3"


def test_parse_entry_is_exact_for_repeating_decimals():
    # The entry keeps every digit the user typed, and the arithmetic is
    # carried out at full double precision.
    assert format_number(parse_entry("0.123456789012")) == "0.123456789012"


# ---------------------------------------------------------------------------
# 3. Behavioural tests driven by key sequences
# ---------------------------------------------------------------------------


def test_key_sequence_addition():
    assert run_key_sequence(["2", "+", "3", "="])["value"] == "5"


def test_key_sequence_decimal():
    assert run_key_sequence(["0", ".", "5", "+", "0", ".", "2", "5", "="])["value"] == "0.75"


def test_key_sequence_negative_numbers():
    assert run_key_sequence(["5", SIGN])["value"] == MINUS + "5"
    assert run_key_sequence(["5", "-", "8", "="])["value"] == MINUS + "3"


def test_key_sequence_operator_chaining():
    assert run_key_sequence(["1", "0", "-", "3", "-", "2", "="])["value"] == "5"


def test_key_sequence_repeated_equals():
    assert run_key_sequence(["2", "+", "3", "="])["value"] == "5"
    assert run_key_sequence(["2", "+", "3", "=", "="])["value"] == "8"
    assert run_key_sequence(["2", "+", "3", "=", "=", "="])["value"] == "11"


def test_key_sequence_backspace():
    assert run_key_sequence(["1", "2", "3", BACKSPACE])["value"] == "12"


def test_key_sequence_clear_entry():
    assert run_key_sequence(["1", "2", "+", "3", "C"])["expression"] == "12 +"


def test_key_sequence_clear_all():
    assert run_key_sequence(["1", "+", "2", "AC"])["value"] == "0"


def test_key_sequence_division_by_zero():
    result = run_key_sequence(["5", DIVIDE, "0", "="])
    assert result["value"] == "Error"
    assert result["error"] == "divide-by-zero"


def test_key_sequence_very_large_numbers():
    # 1e15 x 1e6 — the entry limit is 16 digits, so magnitude is reached by
    # multiplying rather than by typing 22 digits.
    result = run_key_sequence(
        ["1"] + ["0"] * 15 + [TIMES] + ["1"] + ["0"] * 6 + ["="]
    )
    assert result["value"] == "1e+21"


def test_key_sequence_very_small_numbers():
    result = run_key_sequence(["0", "."] + ["0"] * 6 + ["1", TIMES, "1", "="])
    assert result["value"] == "1e" + MINUS + "7"


def test_key_sequence_percentage_semantics():
    assert run_key_sequence(["2", "0", "0", "+", "1", "0", PERCENT, "="])["value"] == "220"
    assert run_key_sequence(["2", "0", "0", TIMES, "1", "0", PERCENT, "="])["value"] == "20"


def test_key_sequence_leading_minus_starts_a_negative_number():
    assert run_key_sequence(["-", "5", "="])["value"] == MINUS + "5"
    assert run_key_sequence(["-", "5", TIMES, "2", "="])["value"] == MINUS + "10"


def test_key_sequence_entry_keeps_the_trailing_decimal_point():
    result = run_key_sequence(["0", "."])
    assert result["expression"] == "0."
    assert result["value"] == "0."


def test_key_sequence_backspace_dismisses_an_error():
    result = run_key_sequence(["5", DIVIDE, "0", "=", BACKSPACE])
    assert result["error"] is None
    assert result["value"] == "0"
    assert result["expression"] == ""


def test_key_sequence_sign_key_toggles_off():
    result = run_key_sequence([SIGN, SIGN])
    assert result["value"] == "0"
    assert result["expression"] == ""


def test_set_entry_replaces_the_current_entry():
    state = calculator_reducer(
        calculator_reducer(
            calculator_reducer(
                CalculatorState(),
                CalculatorAction("digit", digit="1"),
            ),
            CalculatorAction("digit", digit="2"),
        ),
        CalculatorAction("set-entry", value="42"),
    )
    assert state.entry == "42"
    assert derive_display(state)["value"] == "42"


# ---------------------------------------------------------------------------
# 4. Fixture tests — the shared contract
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_reference_engine_matches_fixture(case):
    result = run_key_sequence(case["keys"])
    expected = case["expected"]
    assert result["value"] == expected["value"], case["description"]
    assert result["expression"] == expected["expression"], case["description"]
    assert result["preview"] == expected["preview"], case["description"]
    assert result["error"] == expected["error"], case["description"]


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_frontend_engine_matches_fixture(case, node_results):
    actual = node_results[case["id"]]
    expected = case["expected"]
    assert actual["value"] == expected["value"], case["description"]
    assert actual["expression"] == expected["expression"], case["description"]
    assert actual["preview"] == expected["preview"], case["description"]
    assert actual["error"] == expected["error"], case["description"]


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_frontend_and_reference_engines_agree(case, node_results):
    """The differential test: doubles in the browser, decimals in Python."""
    frontend = node_results[case["id"]]
    reference = run_key_sequence(case["keys"])
    assert frontend == reference, f"engines disagree on {case['id']}: {case['description']}"
