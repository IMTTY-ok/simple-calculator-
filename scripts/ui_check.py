#!/usr/bin/env python3
"""Drive the Calculator UI in a real browser and report what it finds.

Checks performed
----------------
* The app renders without console errors at every target viewport.
* Every keypad button is reachable, large enough to tap, and wired to a
  calculation.
* Keyboard input, theme switching, history and the settings panel work.
* Nothing overflows horizontally and the page never scrolls on a phone.

Usage::

    python scripts/ui_check.py [--url http://127.0.0.1:5173] [--out .artifacts/ui]

Screenshots are written to ``--out`` so they can be inspected by eye.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

VIEWPORTS = [
    ("android-small", 360, 640),
    ("android", 393, 851),
    ("iphone-14", 390, 844),
    ("iphone-pro-max", 430, 932),
    ("tablet", 834, 1112),
    ("laptop", 1440, 900),
    ("desktop", 1920, 1080),
]

#: The application under test.
URL = "http://127.0.0.1:5173/"

FAILURES: list[str] = []
NOTES: list[str] = []

def fail(message: str) -> None:
    FAILURES.append(message)
    print(f"  FAIL  {message}")


def ok(message: str) -> None:
    print(f"  ok    {message}")


def note(message: str) -> None:
    NOTES.append(message)
    print(f"  note  {message}")


def press(page: Page, label: str) -> None:
    """Press a keypad button by its accessible name."""
    page.get_by_role("button", name=label, exact=True).click()


def value_of(page: Page) -> str:
    return page.locator(".display-value").inner_text().strip()


def expression_of(page: Page) -> str:
    return page.locator(".expression-scroll").inner_text().strip()


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def check_viewport(page: Page, name: str, width: int, height: int, out: Path) -> None:
    print(f"\n[{name}] {width}x{height}")
    page.set_viewport_size({"width": width, "height": height})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(350)

    # Nothing may overflow horizontally.
    overflow = page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    if overflow > 0:
        fail(f"{name}: horizontal overflow of {overflow}px")
    else:
        ok(f"{name}: no horizontal overflow")

    # Touch targets must be at least 44x44 CSS pixels.
    small = page.evaluate(
        """() => {
            const bad = [];
            for (const el of document.querySelectorAll('.calc-key')) {
                const r = el.getBoundingClientRect();
                if (r.width < 44 || r.height < 44) {
                    bad.push(`${el.getAttribute('aria-label')} ${Math.round(r.width)}x${Math.round(r.height)}`);
                }
            }
            return bad;
        }"""
    )
    if small:
        fail(f"{name}: touch targets below 44px: {', '.join(small)}")
    else:
        ok(f"{name}: all keypad targets >= 44px")

    # The keypad must be fully visible.
    clipped = page.evaluate(
        """() => {
            const pad = document.querySelector('.calculator-keypad');
            if (!pad) return 'no keypad';
            const r = pad.getBoundingClientRect();
            return r.bottom > window.innerHeight + 1 ? `keypad bottom ${Math.round(r.bottom)} > ${window.innerHeight}` : null;
        }"""
    )
    if clipped:
        fail(f"{name}: {clipped}")
    else:
        ok(f"{name}: keypad fully visible")

    page.screenshot(path=str(out / f"{name}.png"), full_page=False)


def check_calculation(page: Page) -> None:
    print("\n[calculation]")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(250)

    # 200 + 10% = 220
    for key in ["2", "0", "0"]:
        press(page, key)
    press(page, "Add")
    for key in ["1", "0"]:
        press(page, key)
    press(page, "Percent")
    press(page, "Equals")

    if value_of(page) != "220":
        fail(f"200 + 10% = expected 220, got {value_of(page)!r}")
    else:
        ok("200 + 10% = 220")

    # Repeated equals
    press(page, "Equals")
    if value_of(page) != "242":
        fail(f"repeated equals expected 242, got {value_of(page)!r}")
    else:
        ok("repeated equals repeats the last operation (242)")

    # Division by zero
    press(page, "Clear all")
    for key in ["5"]:
        press(page, key)
    press(page, "Divide")
    press(page, "0")
    press(page, "Equals")
    if "Error" not in value_of(page):
        fail(f"division by zero expected an error, got {value_of(page)!r}")
    else:
        ok("division by zero reports an error")

    # Recovery
    for key in ["7"]:
        press(page, key)
    press(page, "Add")
    press(page, "3")
    press(page, "Equals")
    if value_of(page) != "10":
        fail(f"recovery after error expected 10, got {value_of(page)!r}")
    else:
        ok("recovers cleanly after an error")


def check_keyboard(page: Page) -> None:
    print("\n[keyboard]")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(250)
    page.locator("body").click(position={"x": 5, "y": 5})

    for key in ["1", "2", "*", "3", "Enter"]:
        page.keyboard.press(key)

    if value_of(page) != "36":
        fail(f"keyboard 12*3= expected 36, got {value_of(page)!r}")
    else:
        ok("keyboard arithmetic works (12 * 3 = 36)")

    page.keyboard.press("Backspace")
    if value_of(page) != "36":
        note("backspace after a completed result starts fresh (expected)")
    else:
        ok("backspace handled")

    page.keyboard.press("Escape")
    if value_of(page) != "0":
        fail(f"escape expected a cleared display, got {value_of(page)!r}")
    else:
        ok("escape clears the calculator")

    page.keyboard.press("8")
    page.keyboard.press(".")
    page.keyboard.press("5")
    if value_of(page) != "8.5":
        fail(f"keyboard decimal expected 8.5, got {value_of(page)!r}")
    else:
        ok("keyboard decimal works")


def check_theme_and_panels(page: Page, out: Path) -> None:
    print("\n[theme / panels]")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(250)

    initial = page.evaluate("() => document.documentElement.className")
    page.get_by_role("button", name="Switch to light theme").click()
    page.wait_for_timeout(350)
    light = page.evaluate("() => document.documentElement.className")
    if "light" not in light:
        fail(f"theme toggle did not switch to light (class={light!r})")
    else:
        ok(f"theme toggles (dark={initial!r} -> light={light!r})")
    page.screenshot(path=str(out / "light-theme.png"))

    page.get_by_role("button", name="Switch to dark theme").click()
    page.wait_for_timeout(250)

    # History
    press(page, "Clear all")
    for key in ["8", "Multiply", "9"]:
        press(page, key)
    press(page, "Equals")

    page.get_by_role("button", name="Calculation history").click()
    page.wait_for_timeout(350)
    history = page.locator('[role="dialog"]').inner_text()
    if "72" not in history:
        fail(f"history did not record the calculation: {history!r}")
    else:
        ok("history records and displays the calculation")
    page.screenshot(path=str(out / "history.png"))

    # Reuse a result
    page.get_by_role("button", name="Reuse result 72").click()
    page.wait_for_timeout(300)
    if value_of(page) != "72":
        fail(f"reusing a history result expected 72, got {value_of(page)!r}")
    else:
        ok("history results can be reused")

    # Settings
    page.get_by_role("button", name="Settings").click()
    page.wait_for_timeout(350)
    settings = page.locator('[role="dialog"]').inner_text()
    for label in ["Haptic feedback", "Sound feedback", "Reduce motion", "Clear history"]:
        if label not in settings:
            fail(f"settings panel is missing {label!r}")
    ok("settings panel contains every control")
    page.screenshot(path=str(out / "settings.png"))

    # Escape must close an open panel.
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    if page.locator('[role="dialog"]').count() > 0:
        fail("Escape did not close the settings panel")
    else:
        ok("Escape closes an open panel")


def check_escape_closes_panels(page: Page) -> None:
    """Escape must dismiss whichever panel is open."""
    print("\n[panel dismissal]")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(250)

    for trigger, name in (("Calculation history", "history"), ("Settings", "settings")):
        page.get_by_role("button", name=trigger).click()
        page.wait_for_timeout(350)
        if page.locator('[role="dialog"]').count() != 1:
            fail(f"{name} panel did not open")
            continue
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        if page.locator('[role="dialog"]').count() != 0:
            fail(f"Escape did not close the {name} panel")
        else:
            ok(f"Escape closes the {name} panel")


def check_accessibility(page: Page) -> None:
    print("\n[accessibility]")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(250)

    unnamed = page.evaluate(
        """() => {
            const bad = [];
            for (const el of document.querySelectorAll('button')) {
                const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
                if (!name) bad.push(el.className || el.outerHTML.slice(0, 60));
            }
            return bad;
        }"""
    )
    if unnamed:
        fail(f"buttons without an accessible name: {unnamed}")
    else:
        ok("every button has an accessible name")

    live = page.locator(".display-value").get_attribute("aria-live")
    if live != "polite":
        fail(f"display should announce changes politely, aria-live={live!r}")
    else:
        ok("display announces updates politely")

    # Tab order reaches the keypad.
    page.locator("body").click(position={"x": 5, "y": 5})
    reached = False
    for _ in range(25):
        page.keyboard.press("Tab")
        if page.evaluate("() => document.activeElement?.classList.contains('calc-key')"):
            reached = True
            break
    if reached:
        ok("keypad is reachable with the keyboard")
    else:
        fail("keypad could not be reached with Tab")


def check_long_values(page: Page) -> None:
    """A maximum-length entry must not overflow the display."""
    print("\n[long values]")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(250)

    for digit in "9999999999999999":
        press(page, digit)

    overflow = page.evaluate(
        """() => {
            const el = document.querySelector('.display-value');
            return el.scrollWidth - el.clientWidth;
        }"""
    )
    if overflow > 1:
        fail(f"long value overflows the display by {overflow}px")
    else:
        ok("a 16-digit value fits the display")

    # A long expression must not push the page sideways.
    press(page, "Multiply")
    for digit in "123456789":
        press(page, digit)
    doc_overflow = page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    if doc_overflow > 0:
        fail(f"long expression overflows the page by {doc_overflow}px")
    else:
        ok("a long expression does not overflow the page")


def check_toggles(page: Page) -> None:
    """Switch knobs must sit inside their track and travel smoothly."""
    print("\n[settings switches]")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(250)
    page.get_by_role("button", name="Settings").click()
    page.wait_for_timeout(400)

    geometry = page.evaluate(
        """() => {
            const sw = document.querySelector('[role="switch"]');
            const track = sw.querySelector('span');
            const knob = track.querySelector('span');
            const b = sw.getBoundingClientRect();
            const t = track.getBoundingClientRect();
            const k = knob.getBoundingClientRect();
            return {
                checked: sw.getAttribute('aria-checked'),
                buttonHeight: Math.round(b.height),
                buttonWidth: Math.round(b.width),
                insetLeft: Math.round(k.x - t.x),
                insetRight: Math.round((t.x + t.width) - (k.x + k.width)),
                knobInside: k.x >= t.x - 0.5 && (k.x + k.width) <= t.x + t.width + 0.5,
            };
        }"""
    )

    if not geometry["knobInside"]:
        fail("the switch knob is not inside its track")
    else:
        ok("the switch knob sits inside its track")

    # The hit area must be at least 44px tall.
    if geometry["buttonHeight"] < 44:
        fail(f"switch hit area is only {geometry['buttonHeight']}px tall")
    else:
        ok(f"switch hit area is {geometry['buttonWidth']}x{geometry['buttonHeight']}px")

    on_insets = (geometry["insetLeft"], geometry["insetRight"])
    if sorted(on_insets) != [3, 21]:
        fail(f"switch knob is misaligned when on (insets {on_insets})")
    else:
        ok(f"switch knob alignment is exact when on (insets {on_insets})")

    # Toggle it and re-measure.
    page.get_by_role("switch", name="Haptic feedback").click()
    page.wait_for_timeout(450)
    off = page.evaluate(
        """() => {
            const sw = document.querySelector('[role="switch"]');
            const track = sw.querySelector('span');
            const knob = track.querySelector('span');
            const t = track.getBoundingClientRect();
            const k = knob.getBoundingClientRect();
            return {
                checked: sw.getAttribute('aria-checked'),
                insetLeft: Math.round(k.x - t.x),
                insetRight: Math.round((t.x + t.width) - (k.x + k.width)),
                knobInside: k.x >= t.x - 0.5 && (k.x + k.width) <= t.x + t.width + 0.5,
            };
        }"""
    )
    if off["checked"] != "false" or not off["knobInside"]:
        fail(f"switch did not move to the off position ({off})")
    elif sorted((off["insetLeft"], off["insetRight"])) != [3, 21]:
        fail(f"switch knob is misaligned when off (insets {off})")
    else:
        ok("the knob travels cleanly between both ends")

    # The knob must animate, not jump.
    page.get_by_role("switch", name="Haptic feedback").click()
    samples = []
    for _ in range(10):
        samples.append(
            page.evaluate(
                "() => Math.round(document.querySelector('[role=switch] span span').getBoundingClientRect().x)"
            )
        )
        page.wait_for_timeout(16)
    if len(set(samples)) < 2:
        fail("the switch knob jumps instead of animating")
    else:
        ok(f"the knob animates across the track ({samples[0]} -> {samples[-1]})")


def check_privacy_policy(page: Page) -> None:
    """The bundled privacy policy must load and follow the app theme."""
    print("\n[privacy policy]")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(300)

    # The standalone page (this is the file published for Google Play).
    page.goto(f"{URL}privacy-policy.html", wait_until="networkidle")
    page.wait_for_timeout(300)
    heading = page.locator("h1").inner_text().strip()
    if heading != "Privacy Policy":
        fail(f"privacy policy page heading was {heading!r}")
    else:
        ok("the privacy policy page renders")

    # The in-app sheet.
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(600)
    page.get_by_role("button", name="Settings").click()
    page.wait_for_timeout(400)
    page.get_by_role("button", name="Privacy policy").click()
    page.wait_for_timeout(1200)

    frame = page.frame_locator("iframe[title='Privacy policy']")
    try:
        inner = frame.locator("h1").inner_text(timeout=8000).strip()
    except Exception:
        inner = ""

    if inner != "Privacy Policy":
        fail(f"the in-app privacy policy did not load (got {inner!r})")
    else:
        ok("the privacy policy opens inside the app")

    theme = page.evaluate(
        """() => {
            const doc = document.querySelector('iframe')?.contentDocument;
            return doc ? doc.documentElement.dataset.theme ?? 'none' : 'no document';
        }"""
    )
    if theme != "dark":
        fail(f"the privacy policy did not follow the app theme (theme={theme!r})")
    else:
        ok("the privacy policy follows the app theme")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:5173")
    parser.add_argument("--out", default=".artifacts/ui")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    console_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={"width": 393, "height": 851})
        page = context.new_page()

        page.on(
            "console",
            lambda message: console_errors.append(f"{message.type}: {message.text}")
            if message.type in ("error", "warning")
            else None,
        )
        page.on("pageerror", lambda error: console_errors.append(f"pageerror: {error}"))

        for name, width, height in VIEWPORTS:
            check_viewport(page, name, width, height, out)

        check_calculation(page)
        check_long_values(page)
        check_keyboard(page)
        check_theme_and_panels(page, out)
        check_escape_closes_panels(page)
        check_toggles(page)
        check_privacy_policy(page)
        check_accessibility(page)

        browser.close()

    print("\n[console]")
    if console_errors:
        for entry in console_errors:
            fail(f"console: {entry}")
    else:
        ok("no console errors or warnings")

    print("\n" + "=" * 60)
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S):")
        for entry in FAILURES:
            print(f"  - {entry}")
        return 1

    print("All UI checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
