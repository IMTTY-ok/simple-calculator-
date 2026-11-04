#!/usr/bin/env python3
"""Verify the production build: manifest, service worker and offline support.

    python scripts/pwa_check.py --url http://127.0.0.1:4173
"""

from __future__ import annotations

import argparse
import sys
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

FAILURES: list[str] = []


def fail(message: str) -> None:
    FAILURES.append(message)
    print(f"  FAIL  {message}")


def ok(message: str) -> None:
    print(f"  ok    {message}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:4173/")
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(service_workers="allow")
        page = context.new_page()

        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        page.goto(args.url, wait_until="networkidle")
        page.wait_for_timeout(2500)

        # --- manifest ------------------------------------------------------
        manifest_href = page.evaluate(
            "() => document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? null"
        )
        if not manifest_href:
            fail("no manifest link in the document")
        else:
            base = page.url
            manifest_url = urljoin(base, manifest_href)
            response = page.request.get(manifest_url)
            if not response.ok:
                fail(f"manifest could not be fetched ({response.status})")
            else:
                manifest = response.json()
                ok(f"manifest fetched ({manifest_href})")
                for field in ("name", "short_name", "start_url", "display", "theme_color"):
                    if not manifest.get(field):
                        fail(f"manifest is missing {field}")
                icons = manifest.get("icons", [])
                sizes = {icon.get("sizes") for icon in icons}
                if "192x192" not in sizes:
                    fail("manifest has no 192x192 icon")
                elif "512x512" not in sizes:
                    fail("manifest has no 512x512 icon")
                else:
                    ok(f"manifest declares {len(icons)} icons")
                if not any(icon.get("purpose") == "maskable" for icon in icons):
                    fail("manifest has no maskable icon")
                else:
                    ok("manifest declares a maskable icon")

                for icon in icons:
                    icon_url = urljoin(manifest_url, icon["src"])
                    icon_response = page.request.get(icon_url)
                    if not icon_response.ok:
                        fail(f"icon {icon['src']} returned {icon_response.status}")
                ok("every declared icon resolves")

        # --- service worker ------------------------------------------------
        sw_state = page.evaluate(
            """async () => {
                if (!('serviceWorker' in navigator)) return 'unsupported';
                const reg = await navigator.serviceWorker.getRegistration();
                return reg ? 'registered' : 'none';
            }"""
        )
        if sw_state == "registered":
            ok("service worker registered")
        else:
            fail(f"service worker state: {sw_state}")

        # --- offline -------------------------------------------------------
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)
        context.set_offline(True)
        try:
            page.reload(wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            rendered = page.evaluate(
                "() => document.querySelectorAll('.calc-key').length"
            )
            if rendered >= 20:
                ok(f"app still renders offline ({rendered} keys)")
            else:
                fail(f"offline render produced {rendered} keys")

            page.get_by_role("button", name="7", exact=True).click()
            page.get_by_role("button", name="Equals", exact=True).click()
            value = page.locator(".display-value").inner_text().strip()
            if value == "7":
                ok("the calculator still works offline")
            else:
                fail(f"offline calculation returned {value!r}")
        finally:
            context.set_offline(False)

        if errors:
            for entry in errors:
                fail(f"page error: {entry}")
        else:
            ok("no uncaught page errors")

        browser.close()

    print("\n" + "=" * 60)
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S):")
        for entry in FAILURES:
            print(f"  - {entry}")
        return 1
    print("All PWA checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
