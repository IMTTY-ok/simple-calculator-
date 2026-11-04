"""Strip a UTF-8 byte-order-mark from text files that must not have one.

Gradle's `gradle.properties` parser and a few Android build tools choke on a
leading BOM, and PowerShell's `Set-Content -Encoding utf8` adds one.

    python scripts/strip_boms.py
"""

from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

TARGETS = [
    "android/gradle.properties",
    "android/app/build.gradle",
    "android/build.gradle",
    "android/variables.gradle",
    "android/settings.gradle",
    "android/capacitor.settings.gradle",
    "android/app/src/main/res/values/strings.xml",
    "android/app/src/main/res/values/styles.xml",
    "android/app/src/main/res/values/colors.xml",
    "android/app/src/main/res/values/ic_launcher_background.xml",
    "android/app/src/main/AndroidManifest.xml",
    "package.json",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    ".gitattributes",
    ".gitignore",
]

BOM = b"\xef\xbb\xbf"


def main() -> int:
    changed = []
    for relative in TARGETS:
        path = ROOT / relative
        if not path.is_file():
            continue
        data = path.read_bytes()
        if data.startswith(BOM):
            path.write_bytes(data[len(BOM):])
            changed.append(relative)

    if changed:
        print("removed a BOM from:")
        for name in changed:
            print("  ", name)
    else:
        print("no BOMs found")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
