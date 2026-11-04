#!/usr/bin/env python3
"""Capture the Google Play phone screenshots from the running application.

The screenshots are real captures of the production build — not mock-ups —
so the store listing shows exactly what a user gets.

    python scripts/capture_screenshots.py --url http://127.0.0.1:4173/
"""

from __future__ import annotations

import argparse
import pathlib
import sys

from playwright.sync_api import Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "store-assets" / "screenshots"

#: 360 x 640 CSS pixels at a 3x device pixel ratio gives 1080 x 1920, which
#: is the most common Android screenshot size and satisfies Play's rules.
VIEWPORT = {"width": 360, "height": 640}
DEVICE_SCALE = 3


def press(page: Page, label: str) -> None:
    page.get_by_role("button", name=label, exact=True).click()


def type_digits(page: Page, digits: str) -> None:
    for digit in digits:
        press(page, digit)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:4173/")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=DEVICE_SCALE,
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.goto(args.url, wait_until="networkidle")
        page.wait_for_timeout(700)

        # 1 — the calculator at rest, dark theme.
        page.screenshot(path=str(OUT / "01-calculator-dark.png"))

        # 2 — a finished calculation with the expression preserved.
        type_digits(page, "1234")
        press(page, "Multiply")
        type_digits(page, "56")
        press(page, "Equals")
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUT / "02-calculation-result.png"))

        # 3 — mid-calculation, showing the live preview and the pending operator.
        press(page, "Clear all")
        type_digits(page, "200")
        press(page, "Add")
        type_digits(page, "1234")
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUT / "03-live-preview.png"))

        # 4 — the history panel.
        press(page, "Clear all")
        type_digits(page, "987")
        press(page, "Divide")
        type_digits(page, "4")
        press(page, "Equals")
        page.wait_for_timeout(250)
        page.get_by_role("button", name="Calculation history").click()
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "04-history.png"))

        # 5 — the settings panel.
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Settings").click()
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "05-settings.png"))

        # 6 — the light theme.
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        page.get_by_role("button", name="Switch to light theme").click()
        page.wait_for_timeout(700)
        type_digits(page, "42")
        press(page, "Add")
        type_digits(page, "17")
        press(page, "Equals")
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUT / "06-light-theme.png"))

        browser.close()

    for path in sorted(OUT.glob("*.png")):
        print(f"  {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
