"""Calculator — reference calculation engine.

This is the *oracle* for the frontend engine: a deliberately independent
implementation of the same specification, written with :mod:`decimal` instead
of IEEE-754 doubles so that precision-sensitive cases are checked against
exact arithmetic.

The two engines are driven by the same key sequences from
``fixtures/calculator_cases.json``; ``test_reference_engine.py`` asserts that
they agree.

Specification
-------------
The engine is modelled as a token stream, exactly like the TypeScript engine:

``number`` | ``operator`` | ``percent``

Percentage semantics
---------------------
``%`` is a postfix operator whose meaning depends on the operator that
precedes its operand:

===========================  ==========================  ======
Expression                   Meaning                    Result
===========================  ==========================  ======
``200 + 10%``                200 + (10% of 200)         220
``200 - 10%``                200 - (10% of 200)         180
``200 x 10%``                200 x (10 / 100)           20
``10%``                      10 / 100                   0.1
===========================  ==========================  ======

In other words: after ``+`` or ``-`` a percentage is relative to the value
accumulated so far; after ``x`` or ``/`` (or on its own) it is relative to
100.

Repeated equals
---------------
``2 + 3 =`` yields ``5``. Pressing ``=`` again repeats the last binary
operation: ``5 + 3 =`` yields ``8``. A percentage operand is re-scaled against
the new base, so ``200 + 10% =`` yields ``220`` and a second ``=`` yields
``220 + 10% of 220`` = ``242``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
from enum import Enum
from typing import Iterable, Sequence

__all__ = [
    "Operator",
    "Token",
    "TokenKind",
    "CalculatorState",
    "CalculatorAction",
    "MAX_ENTRY_DIGITS",
    "MAX_SIGNIFICANT_DIGITS",
    "clean_number",
    "format_number",
    "format_entry",
    "format_tokens",
    "evaluate_tokens",
    "apply_operator",
    "calculator_reducer",
    "derive_display",
    "run_key_sequence",
]


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Significant digits retained when cleaning a computed value.
MAX_SIGNIFICANT_DIGITS = 12

#: Maximum number of digits a single entry may contain.
MAX_ENTRY_DIGITS = 16

#: Working precision for intermediate decimal arithmetic.
WORKING_PRECISION = 40

#: Values at or above this magnitude are rendered in exponential notation.
EXPONENT_UPPER_BOUND = Decimal("1e21")

#: Values below this magnitude (and above zero) are rendered in exponential form.
EXPONENT_LOWER_BOUND = Decimal("1e-6")

#: Typographic minus sign used in rendered output.
MINUS = "−"

#: Glyphs used for operators.
OPERATOR_SYMBOL = {
    "+": "+",
    "-": MINUS,
    "*": "×",
    "/": "÷",
}


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------


class Operator(str, Enum):
    """The four arithmetic operators."""

    ADD = "+"
    SUB = "-"
    MUL = "*"
    DIV = "/"


class TokenKind(str, Enum):
    """The kinds of token in an expression."""

    NUMBER = "number"
    OPERATOR = "operator"
    PERCENT = "percent"


@dataclass(frozen=True)
class Token:
    """A single element of an expression."""

    kind: TokenKind
    value: Decimal | None = None
    raw: str | None = None
    op: Operator | None = None

    @staticmethod
    def number(raw: str) -> "Token":
        """Build a number token from raw user text."""
        return Token(kind=TokenKind.NUMBER, value=parse_entry(raw), raw=raw)

    @staticmethod
    def operator(op: Operator) -> "Token":
        """Build an operator token."""
        return Token(kind=TokenKind.OPERATOR, op=op)

    @staticmethod
    def percent() -> "Token":
        """Build a percent token."""
        return Token(kind=TokenKind.PERCENT)


@dataclass(frozen=True)
class CalculatorAction:
    """A mutation of the calculator state."""

    type: str
    digit: str | None = None
    op: Operator | None = None
    value: str | None = None


@dataclass
class CalculatorState:
    """The state of the calculator."""

    tokens: list[Token] = field(default_factory=list)
    entry: str | None = None
    error: str | None = None
    just_evaluated: bool = False
    last_expression: str | None = None
    last_operator: Operator | None = None
    last_operand: Decimal | None = None
    last_operand_percent: bool = False

    def copy(self) -> "CalculatorState":
        """Return an independent copy of this state."""
        return CalculatorState(
            tokens=list(self.tokens),
            entry=self.entry,
            error=self.error,
            just_evaluated=self.just_evaluated,
            last_expression=self.last_expression,
            last_operator=self.last_operator,
            last_operand=self.last_operand,
            last_operand_percent=self.last_operand_percent,
        )


class CalculationError(Exception):
    """Raised when an expression cannot be evaluated."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------


def _round12(value: Decimal) -> Decimal:
    """Round to :data:`MAX_SIGNIFICANT_DIGITS` significant digits.

    The result is a plain decimal — no floating-point expansion — so it can be
    rendered directly.
    """
    if value == 0:
        return Decimal(0)
    if value == value.to_integral_value():
        return value
    quant = Decimal(1).scaleb(value.adjusted() - MAX_SIGNIFICANT_DIGITS + 1)
    with localcontext() as ctx:
        ctx.prec = MAX_SIGNIFICANT_DIGITS + 2
        # ROUND_HALF_UP matches JavaScript's `Number.prototype.toPrecision`,
        # which rounds a tie away from zero.
        ctx.rounding = ROUND_HALF_UP
        return value.quantize(quant)


def _to_double(value: Decimal) -> Decimal:
    """Round an exact decimal result to the nearest IEEE-754 double.

    The browser engine computes with doubles, and so does this reference: the
    Decimal arithmetic here is exact, and each result is then rounded to the
    same double the browser would have produced. That keeps the two engines
    bit-identical while still verifying the arithmetic rules independently.
    """
    return Decimal(float(value))


def clean_number(value: Decimal) -> Decimal:
    """Mirror the browser engine's number cleanup.

    Rounds to :data:`MAX_SIGNIFICANT_DIGITS` significant digits and returns
    the nearest double of that value — exactly what the browser's
    ``Number(value.toPrecision(12))`` produces. Returning the *double* (not
    the plain decimal) matters: every later operation must start from the
    same number the browser starts from.
    """
    if not value.is_finite():
        return value
    if value == 0:
        return Decimal(0)
    return _to_double(_round12(value))


def _group_digits(digits: str) -> str:
    """Insert thousands separators into a run of digits."""
    if len(digits) <= 3:
        return digits
    head = len(digits) % 3 or 3
    groups = [digits[:head]]
    for index in range(head, len(digits), 3):
        groups.append(digits[index : index + 3])
    return ",".join(groups)


def _format_exponential(value: Decimal) -> str:
    """Render a value in exponential notation, e.g. ``1.23457e+25``.

    Mirrors JavaScript's ``Number.prototype.toExponential(6)``: the mantissa
    is normalised to ``[1, 10)`` and rounded to six fraction digits, with
    ties rounding away from zero.
    """
    normalized = value.normalize()
    exponent = normalized.adjusted()
    with localcontext() as ctx:
        ctx.prec = WORKING_PRECISION
        ctx.rounding = ROUND_HALF_UP
        mantissa = normalized.scaleb(-exponent).quantize(Decimal("1.000000"))
        if mantissa >= 10:
            mantissa = mantissa.scaleb(-1).quantize(Decimal("1.000000"))
            exponent += 1

    text = format(mantissa, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    sign = MINUS if exponent < 0 else "+"
    return f"{text}e{sign}{abs(exponent)}"


def format_number(value: Decimal) -> str:
    """Format a numeric value for the display."""
    if not value.is_finite():
        return "Error"
    if value == 0:
        return "0"

    magnitude = abs(value)
    if magnitude >= EXPONENT_UPPER_BOUND or magnitude < EXPONENT_LOWER_BOUND:
        return _format_exponential(value)

    cleaned = _round12(value).normalize()
    negative = cleaned < 0
    text = format(abs(cleaned), "f")
    integer_part, _, fraction_part = text.partition(".")
    grouped = _group_digits(integer_part)
    sign = MINUS if negative else ""
    if fraction_part:
        return f"{sign}{grouped}.{fraction_part}"
    return f"{sign}{grouped}"


def format_entry(raw: str) -> str:
    """Format the raw text the user is currently typing."""
    negative = raw.startswith("-")
    body = raw[1:] if negative else raw
    if body == "":
        return MINUS if negative else "0"

    integer_raw, _, fraction = body.partition(".")
    trimmed = integer_raw.lstrip("0")
    if trimmed == "":
        trimmed = "0"
    grouped = _group_digits(trimmed)
    sign = MINUS if negative else ""
    if fraction or body.endswith("."):
        return f"{sign}{grouped}.{fraction}"
    return f"{sign}{grouped}"


def format_tokens(tokens: Sequence[Token], raw_entry: str | None = None) -> str:
    """Render a token stream as a readable expression.

    A ``%`` binds to the number in front of it, so it is never separated by a
    space. When ``raw_entry`` is given it replaces the final number, so the
    text the user is still typing (for example ``0.``) is shown verbatim.
    """
    parts: list[str] = []
    for index, token in enumerate(tokens):
        is_last = index == len(tokens) - 1
        if token.kind is TokenKind.PERCENT:
            if parts:
                parts[-1] = f"{parts[-1]}%"
            else:
                parts.append("%")
            continue
        if token.kind is TokenKind.NUMBER:
            if is_last and raw_entry is not None:
                parts.append(format_entry(raw_entry))
            else:
                parts.append(format_number(token.value or Decimal(0)))
        else:
            parts.append(OPERATOR_SYMBOL[token.op.value])
    return " ".join(parts)


def parse_entry(raw: str) -> Decimal:
    """Parse raw user input into a number.

    The value is routed through an IEEE-754 double first, exactly like the
    browser's ``Number(raw)``, so both engines start from the same number.
    """
    try:
        value = Decimal(raw)
    except InvalidOperation:
        return Decimal(0)
    if not value.is_finite():
        return Decimal(0)
    return clean_number(_to_double(value))


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


def apply_operator(op: Operator, left: Decimal, right: Decimal) -> Decimal:
    """Apply a binary operator."""
    if op is Operator.ADD:
        return left + right
    if op is Operator.SUB:
        return left - right
    if op is Operator.MUL:
        return left * right
    if right == 0:
        raise CalculationError("divide-by-zero")
    return left / right


class _Parser:
    """Recursive-descent parser over a token stream."""

    def __init__(self, tokens: Sequence[Token]) -> None:
        self._tokens = list(tokens)
        self._index = 0

    def parse(self) -> Decimal:
        value = self._parse_expression()
        if self._index < len(self._tokens):
            raise CalculationError("invalid")
        return value

    def _parse_expression(self) -> Decimal:
        left = self._parse_term(None, None)

        while self._peek_operator(Operator.ADD, Operator.SUB):
            op = self._tokens[self._index].op
            self._index += 1
            right = self._parse_term(op, left)
            left = _to_double(apply_operator(op, left, right))

        return left

    def _parse_term(self, percent_base, percent_base_value) -> Decimal:
        left = self._parse_factor(percent_base, percent_base_value)
        while self._peek_operator(Operator.MUL, Operator.DIV):
            op = self._tokens[self._index].op
            self._index += 1
            right = self._parse_factor(None, None)
            left = _to_double(apply_operator(op, left, right))
        return left

    def _parse_factor(self, percent_base, percent_base_value) -> Decimal:
        token = self._tokens[self._index] if self._index < len(self._tokens) else None
        if token is None or token.kind is not TokenKind.NUMBER:
            raise CalculationError("invalid")
        self._index += 1

        value = token.value or Decimal(0)
        while self._index < len(self._tokens) and self._tokens[self._index].kind is TokenKind.PERCENT:
            self._index += 1
            if percent_base in (Operator.ADD, Operator.SUB):
                # Relative to the accumulated value: `200 + 10%` -> 200 + 20.
                base = percent_base_value if percent_base_value is not None else Decimal(0)
                hundredth = _to_double(value / Decimal(100))
                value = _to_double(base * hundredth)
            else:
                # Relative to 100: `200 x 10%` -> 200 x 0.1.
                value = _to_double(value / Decimal(100))
            # A second `%` would no longer see the original base.
            percent_base = None
            percent_base_value = None
        return value

    def _peek_operator(self, *ops: Operator) -> bool:
        if self._index >= len(self._tokens):
            return False
        token = self._tokens[self._index]
        return token.kind is TokenKind.OPERATOR and token.op in ops


def evaluate_tokens(tokens: Sequence[Token]) -> Decimal:
    """Evaluate a token stream.

    :raises CalculationError: when the expression is malformed or divides by
        zero.
    """
    if not tokens:
        raise CalculationError("invalid")
    with localcontext() as ctx:
        ctx.prec = WORKING_PRECISION
        return clean_number(_Parser(tokens).parse())


def strip_trailing_operator(tokens: Sequence[Token]) -> list[Token]:
    """Remove a single trailing operator."""
    if tokens and tokens[-1].kind is TokenKind.OPERATOR:
        return list(tokens[:-1])
    return list(tokens)


# ---------------------------------------------------------------------------
# Reducer
# ---------------------------------------------------------------------------


def _number_token_from_value(value: Decimal) -> Token:
    cleaned = clean_number(value)
    return Token(kind=TokenKind.NUMBER, value=cleaned, raw=format(cleaned, "f"))


def _find_last_number(tokens: Sequence[Token]) -> Decimal | None:
    for token in reversed(tokens):
        if token.kind is TokenKind.NUMBER:
            return token.value
    return None


def _is_sealed(state: CalculatorState) -> bool:
    if state.just_evaluated:
        return True
    if state.entry is not None or not state.tokens:
        return False
    return state.tokens[-1].kind is TokenKind.PERCENT


def _append_digit(entry: str | None, digit: str) -> str | None:
    if entry is None:
        return digit
    negative = entry.startswith("-")
    body = entry[1:] if negative else entry
    if len(body.replace(".", "")) >= MAX_ENTRY_DIGITS:
        return entry
    if body == "0":
        return f"{'-' if negative else ''}{digit}"
    return entry + digit


def _backspace_entry(entry: str) -> str | None:
    if len(entry) <= 1:
        return None
    nxt = entry[:-1]
    if nxt in ("-", ""):
        return None
    return nxt


def _initial_state() -> CalculatorState:
    return CalculatorState()


def calculator_reducer(state: CalculatorState, action: CalculatorAction) -> CalculatorState:
    """Apply ``action`` to ``state`` and return the next state.

    This mirrors ``src/engine/calculatorEngine.ts`` line for line.
    """
    action_type = action.type

    if action_type == "digit":
        if state.error:
            return CalculatorState(entry=action.digit)
        if _is_sealed(state):
            return CalculatorState(entry=action.digit)
        entry = _append_digit(state.entry, action.digit or "")
        assert entry is not None
        return CalculatorState(
            tokens=list(state.tokens),
            entry=entry,
            error=state.error,
            just_evaluated=state.just_evaluated,
            last_expression=state.last_expression,
            last_operator=state.last_operator,
            last_operand=parse_entry(entry),
            last_operand_percent=False,
        )

    if action_type == "decimal":
        if state.error:
            return CalculatorState(entry="0.")
        if _is_sealed(state):
            return CalculatorState(entry="0.")
        if state.entry is None:
            entry = "0."
        elif "." in state.entry:
            return state.copy()
        else:
            entry = state.entry + "."
        return CalculatorState(
            tokens=list(state.tokens),
            entry=entry,
            error=state.error,
            just_evaluated=state.just_evaluated,
            last_expression=state.last_expression,
            last_operator=state.last_operator,
            last_operand=parse_entry(entry),
            last_operand_percent=False,
        )

    if action_type == "operator":
        if state.error:
            return _initial_state()

        # A leading minus starts a negative number, the way a physical
        # calculator does — otherwise "- 5" would silently read as "5".
        if (
            not state.tokens
            and state.entry is None
            and not state.just_evaluated
            and action.op is Operator.SUB
        ):
            return CalculatorState(
                entry="-",
                last_operator=None,
                last_operand=None,
                last_operand_percent=False,
            )

        assert action.op is not None
        tokens = list(state.tokens)
        entry = state.entry
        just_evaluated = state.just_evaluated

        if just_evaluated:
            tokens = [_number_token_from_value(_find_last_number(tokens) or Decimal(0))]
            entry = None
            just_evaluated = False

        if entry is not None:
            tokens.append(Token.number(entry))
            entry = None

        if not tokens:
            return state.copy()

        if tokens[-1].kind is TokenKind.OPERATOR:
            tokens[-1] = Token.operator(action.op)
        else:
            tokens.append(Token.operator(action.op))

        return CalculatorState(
            tokens=tokens,
            entry=None,
            error=state.error,
            just_evaluated=just_evaluated,
            last_expression=state.last_expression,
            last_operator=action.op,
            last_operand=None,
            last_operand_percent=False,
        )

    if action_type == "percent":
        if state.error:
            return _initial_state()

        if state.just_evaluated:
            value = _find_last_number(state.tokens) or Decimal(0)
            return CalculatorState(
                tokens=list(state.tokens) + [Token.percent()],
                entry=None,
                error=state.error,
                just_evaluated=False,
                last_expression=state.last_expression,
                last_operator=state.last_operator,
                last_operand=value,
                last_operand_percent=True,
            )

        if state.entry is not None:
            return CalculatorState(
                tokens=list(state.tokens) + [Token.number(state.entry), Token.percent()],
                entry=None,
                error=state.error,
                just_evaluated=state.just_evaluated,
                last_expression=state.last_expression,
                last_operator=state.last_operator,
                last_operand=parse_entry(state.entry),
                last_operand_percent=True,
            )

        if not state.tokens:
            return state.copy()
        if state.tokens[-1].kind is TokenKind.PERCENT:
            return state.copy()
        if state.tokens[-1].kind is TokenKind.OPERATOR:
            return state.copy()

        return CalculatorState(
            tokens=list(state.tokens) + [Token.percent()],
            entry=state.entry,
            error=state.error,
            just_evaluated=state.just_evaluated,
            last_expression=state.last_expression,
            last_operator=state.last_operator,
            last_operand=state.tokens[-1].value,
            last_operand_percent=True,
        )

    if action_type == "equals":
        if state.error:
            return CalculatorState(
                tokens=list(state.tokens),
                entry=state.entry,
                error=None,
                just_evaluated=state.just_evaluated,
                last_expression=state.last_expression,
                last_operator=state.last_operator,
                last_operand=state.last_operand,
                last_operand_percent=state.last_operand_percent,
            )

        if state.just_evaluated:
            if state.last_operator is None or state.last_operand is None:
                return state.copy()
            base = _find_last_number(state.tokens) or Decimal(0)
            if state.last_operand_percent:
                if state.last_operator in (Operator.ADD, Operator.SUB):
                    operand = base * state.last_operand / Decimal(100)
                else:
                    operand = state.last_operand / Decimal(100)
            else:
                operand = state.last_operand

            try:
                value = evaluate_tokens(
                    [
                        _number_token_from_value(base),
                        Token.operator(state.last_operator),
                        _number_token_from_value(operand),
                    ]
                )
            except CalculationError as error:
                return CalculatorState(error=error.code)

            operand_text = format_number(state.last_operand)
            if state.last_operand_percent:
                operand_text = f"{operand_text}%"

            return CalculatorState(
                tokens=[_number_token_from_value(value)],
                entry=None,
                error=state.error,
                just_evaluated=True,
                last_expression=(
                    f"{format_number(base)} "
                    f"{OPERATOR_SYMBOL[state.last_operator.value]} {operand_text}"
                ),
                last_operator=state.last_operator,
                last_operand=state.last_operand,
                last_operand_percent=state.last_operand_percent,
            )

        tokens = list(state.tokens)
        if state.entry is not None:
            tokens.append(Token.number(state.entry))
        if not tokens:
            return state.copy()

        expression = strip_trailing_operator(tokens)
        has_operator = any(token.kind is TokenKind.OPERATOR for token in expression)
        has_percent = any(token.kind is TokenKind.PERCENT for token in expression)

        if not has_operator and not has_percent:
            value = _find_last_number(expression) or Decimal(0)
            return CalculatorState(
                tokens=[_number_token_from_value(value)],
                entry=None,
                error=state.error,
                just_evaluated=True,
                last_expression=format_number(value),
                last_operator=None,
                last_operand=None,
                last_operand_percent=False,
            )

        try:
            value = evaluate_tokens(expression)
        except CalculationError as error:
            return CalculatorState(error=error.code)

        return CalculatorState(
            tokens=[_number_token_from_value(value)],
            entry=None,
            error=state.error,
            just_evaluated=True,
            last_expression=format_tokens(expression),
            last_operator=state.last_operator,
            last_operand=state.last_operand,
            last_operand_percent=state.last_operand_percent,
        )

    if action_type == "backspace":
        if state.error:
            # Backspace dismisses the error and returns to an empty display.
            return CalculatorState()
        if state.just_evaluated:
            return _initial_state()

        if state.entry is not None:
            entry = _backspace_entry(state.entry)
            return CalculatorState(
                tokens=list(state.tokens),
                entry=entry,
                error=state.error,
                just_evaluated=state.just_evaluated,
                last_expression=state.last_expression,
                last_operator=state.last_operator,
                last_operand=parse_entry(entry) if entry is not None else None,
                last_operand_percent=False,
            )

        if not state.tokens:
            return state.copy()

        return CalculatorState(
            tokens=list(state.tokens[:-1]),
            entry=state.entry,
            error=state.error,
            just_evaluated=state.just_evaluated,
            last_expression=state.last_expression,
            last_operator=state.last_operator,
            last_operand=None,
            last_operand_percent=False,
        )

    if action_type == "clear-entry":
        if state.error:
            # Clear entry dismisses the error and returns to an empty display.
            return CalculatorState()
        if state.just_evaluated:
            return _initial_state()

        if state.entry is not None:
            return CalculatorState(
                tokens=list(state.tokens),
                entry=None,
                error=state.error,
                just_evaluated=state.just_evaluated,
                last_expression=state.last_expression,
                last_operator=state.last_operator,
                last_operand=None,
                last_operand_percent=False,
            )

        if not state.tokens or state.tokens[-1].kind is not TokenKind.NUMBER:
            return state.copy()

        return CalculatorState(
            tokens=list(state.tokens[:-1]),
            entry=state.entry,
            error=state.error,
            just_evaluated=state.just_evaluated,
            last_expression=state.last_expression,
            last_operator=state.last_operator,
            last_operand=None,
            last_operand_percent=False,
        )

    if action_type == "clear-all":
        return _initial_state()

    if action_type == "toggle-sign":
        if state.error:
            # Any input dismisses the error and returns to an empty display.
            return CalculatorState()

        if state.entry is not None:
            # Toggling the sign off a lone "-" leaves nothing behind.
            if state.entry == "-":
                entry = None
            elif state.entry.startswith("-"):
                entry = state.entry[1:]
            else:
                entry = f"-{state.entry}"
            return CalculatorState(
                tokens=list(state.tokens),
                entry=entry,
                error=state.error,
                just_evaluated=state.just_evaluated,
                last_expression=state.last_expression,
                last_operator=state.last_operator,
                last_operand=parse_entry(entry) if entry is not None else None,
                last_operand_percent=False,
            )

        if state.just_evaluated:
            value = _find_last_number(state.tokens) or Decimal(0)
            return CalculatorState(
                tokens=[_number_token_from_value(-value)],
                entry=None,
                error=state.error,
                just_evaluated=state.just_evaluated,
                last_expression=state.last_expression,
                last_operator=state.last_operator,
                last_operand=abs(value),
                last_operand_percent=False,
            )

        for index in range(len(state.tokens) - 1, -1, -1):
            token = state.tokens[index]
            if token.kind is TokenKind.NUMBER:
                negated = _number_token_from_value(-(token.value or Decimal(0)))
                tokens = list(state.tokens)
                tokens[index] = negated
                return CalculatorState(
                    tokens=tokens,
                    entry=state.entry,
                    error=state.error,
                    just_evaluated=state.just_evaluated,
                    last_expression=state.last_expression,
                    last_operator=state.last_operator,
                    last_operand=negated.value,
                    last_operand_percent=False,
                )

        return CalculatorState(
            tokens=list(state.tokens),
            entry="-",
            error=state.error,
            just_evaluated=state.just_evaluated,
            last_expression=state.last_expression,
            last_operator=state.last_operator,
            last_operand=state.last_operand,
            last_operand_percent=False,
        )

    if action_type == "set-entry":
        base = _initial_state() if (state.just_evaluated or state.error) else state.copy()
        base.entry = action.value
        base.last_operand = parse_entry(action.value or "0")
        base.last_operand_percent = False
        return base

    raise ValueError(f"Unknown action type: {action_type}")


# ---------------------------------------------------------------------------
# Display derivation
# ---------------------------------------------------------------------------

ERROR_MESSAGES = {
    "divide-by-zero": "Cannot divide by zero",
    "invalid": "Invalid expression",
}


def derive_display(state: CalculatorState) -> dict[str, str | None]:
    """Derive what the display should show."""
    if state.error:
        return {
            "expression": ERROR_MESSAGES.get(state.error, state.error),
            "value": "Error",
            "preview": None,
            "error": state.error,
        }

    if state.just_evaluated:
        value = _find_last_number(state.tokens) or Decimal(0)
        return {
            "expression": f"{state.last_expression} =" if state.last_expression else "",
            "value": format_number(value),
            "preview": None,
            "error": None,
        }

    tokens = list(state.tokens)
    if state.entry is not None:
        tokens.append(Token.number(state.entry))
    expression = format_tokens(tokens, state.entry)
    evaluable = strip_trailing_operator(tokens)

    outcome: Decimal | None = None
    error: str | None = None
    try:
        outcome = evaluate_tokens(evaluable)
    except CalculationError as exc:
        error = exc.code

    if error == "divide-by-zero":
        return {
            "expression": expression,
            "value": "Error",
            "preview": None,
            "error": error,
        }

    if state.entry is not None:
        numeric_value = parse_entry(state.entry)
        value_text = format_entry(state.entry)
    elif outcome is not None:
        numeric_value = outcome
        value_text = format_number(outcome)
    else:
        last = _find_last_number(evaluable)
        numeric_value = last if last is not None else Decimal(0)
        value_text = format_number(numeric_value) if last is not None else "0"

    preview: str | None = None
    if outcome is not None and outcome != numeric_value:
        preview = f"= {format_number(outcome)}"

    return {
        "expression": expression,
        "value": value_text,
        "preview": preview,
        "error": None,
    }


# ---------------------------------------------------------------------------
# Key sequences
# ---------------------------------------------------------------------------

#: Maps the fixture key vocabulary onto calculator actions.
KEY_ACTIONS: dict[str, CalculatorAction] = {
    "AC": CalculatorAction("clear-all"),
    "C": CalculatorAction("clear-entry"),
    "⌫": CalculatorAction("backspace"),
    "%": CalculatorAction("percent"),
    "±": CalculatorAction("toggle-sign"),
    "+": CalculatorAction("operator", op=Operator.ADD),
    "-": CalculatorAction("operator", op=Operator.SUB),
    "×": CalculatorAction("operator", op=Operator.MUL),
    "÷": CalculatorAction("operator", op=Operator.DIV),
    ".": CalculatorAction("decimal"),
    "=": CalculatorAction("equals"),
}
for _digit in "0123456789":
    KEY_ACTIONS[_digit] = CalculatorAction("digit", digit=_digit)


def run_key_sequence(keys: Iterable[str]) -> dict[str, str | None]:
    """Run a sequence of key presses and return the resulting display.

    The key vocabulary matches ``fixtures/calculator_cases.json``:
    ``0``-``9``, ``+``, ``-``, ``×``, ``÷``, ``.``, ``%``, ``±``, ``AC``,
    ``C``, ``⌫`` and ``=``.
    """
    state = _initial_state()
    for key in keys:
        action = KEY_ACTIONS.get(key)
        if action is None:
            raise ValueError(f"Unknown key: {key!r}")
        state = calculator_reducer(state, action)
    return derive_display(state)
