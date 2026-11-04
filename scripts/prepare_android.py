#!/usr/bin/env python3
"""Prepare the Android project before a Gradle build.

Gradle's wrapper will occasionally rewrite ``gradle-wrapper.properties`` with
its own default distribution. When that default is newer than the Android
Gradle Plugin supports, the build fails with an obscure error about
``AndroidProblemReporterProvider``. This script puts the wrapper back on the
version the plugin expects, so the build is deterministic.

It also makes sure the machine-specific pieces are in place:

* ``android/local.properties`` — where the Android SDK lives.
* ``android/keystore.properties`` — the release signing credentials (warns
  if missing, because the release build would then be unsigned).

    python scripts/prepare_android.py
"""

from __future__ import annotations

import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ANDROID = ROOT / "android"
WRAPPER = ANDROID / "gradle" / "wrapper" / "gradle-wrapper.properties"
LOCAL_PROPERTIES = ANDROID / "local.properties"
KEYSTORE_PROPERTIES = ANDROID / "keystore.properties"

#: The Gradle version that Android Gradle Plugin 8.13 supports.
REQUIRED_GRADLE = "8.14.3"

#: Where the Android SDK is expected if the environment does not say.
DEFAULT_SDK_DIRS = [
    pathlib.Path(r"D:\android-sdk"),
    pathlib.Path.home() / "AppData" / "Local" / "Android" / "Sdk",
    pathlib.Path("/usr/lib/android-sdk"),
    pathlib.Path.home() / "Android" / "Sdk",
]


def fix_gradle_wrapper() -> bool:
    """Point the wrapper at the Gradle version the Android plugin supports."""
    if not WRAPPER.is_file():
        print(f"  ! {WRAPPER} is missing")
        return False

    text = WRAPPER.read_text(encoding="utf-8")
    match = re.search(r"distributionUrl=(.*gradle-)([\d.]+)(-[a-z]+)?\.zip", text)
    if not match:
        print("  ! could not read distributionUrl from the wrapper properties")
        return False

    current = match.group(2)
    if current == REQUIRED_GRADLE:
        print(f"  ok Gradle {REQUIRED_GRADLE}")
        return True

    print(f"  ! Gradle wrapper pointed at {current}, restoring {REQUIRED_GRADLE}")
    updated = re.sub(
        r"distributionUrl=.*gradle-[\d.]+(-[a-z]+)?\.zip",
        f"distributionUrl=https\\://services.gradle.org/distributions/gradle-{REQUIRED_GRADLE}-all.zip",
        text,
    )
    WRAPPER.write_text(updated, encoding="utf-8", newline="\n")
    print(f"  ok Gradle wrapper pinned to {REQUIRED_GRADLE}")
    return True


def find_sdk() -> pathlib.Path | None:
    """Locate the Android SDK."""
    for variable in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        value = os.environ.get(variable)
        if value and pathlib.Path(value).is_dir():
            return pathlib.Path(value)
    for candidate in DEFAULT_SDK_DIRS:
        if candidate.is_dir():
            return candidate
    return None


def ensure_local_properties() -> bool:
    """Write android/local.properties if it is missing."""
    sdk = find_sdk()
    if sdk is None:
        print("  ! could not find the Android SDK — set ANDROID_HOME")
        return False

    expected = f"sdk.dir={sdk.as_posix()}"
    if LOCAL_PROPERTIES.is_file():
        current = LOCAL_PROPERTIES.read_text(encoding="utf-8")
        if expected in current:
            print(f"  ok Android SDK at {sdk}")
            return True

    LOCAL_PROPERTIES.write_text(
        "# This file is machine-specific and is not committed to git.\n"
        "# It tells Gradle where the Android SDK is installed on this computer.\n"
        f"{expected}\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"  ok Android SDK at {sdk}")
    return True


def check_keystore() -> bool:
    """Warn when the release signing credentials are missing."""
    if KEYSTORE_PROPERTIES.is_file():
        print("  ok release signing credentials found")
        return True

    print("  ! android/keystore.properties is missing — the release build will")
    print("    be UNSIGNED. Run `npm run signing:key` to create the key.")
    return False


def main() -> int:
    print("Preparing the Android project")
    ok = True
    ok = fix_gradle_wrapper() and ok
    ok = ensure_local_properties() and ok
    check_keystore()
    print("Done.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
