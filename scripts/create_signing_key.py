#!/usr/bin/env python3
"""Create the Android release-signing key for the Calculator app.

The keystore is written **outside** the repository (by default to
``~/.pulse-calc-signing``) and the credentials are written to
``android/keystore.properties``, which is listed in ``.gitignore``. Neither
the key nor the passwords are ever committed.

Run once, before the first release::

    python scripts/create_signing_key.py

If a keystore already exists the script stops and asks you to keep it —
a lost release key means you can never update the app on Google Play again.
"""

from __future__ import annotations

import argparse
import pathlib
import secrets
import shutil
import string
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_KEYSTORE_DIR = pathlib.Path.home() / ".pulse-calc-signing"
KEYSTORE_NAME = "calculator-release.jks"
ALIAS = "calculator"
VALIDITY_DAYS = 10000  # ~27 years; Google Play needs the key valid past 2033.

DISTINGUISHABLE = string.ascii_letters + string.digits


def generate_password(length: int = 28) -> str:
    """A random password with no characters that need escaping in a file."""
    return "".join(secrets.choice(DISTINGUISHABLE) for _ in range(length))


def find_keytool() -> str | None:
    """Locate the JDK's keytool."""
    found = shutil.which("keytool")
    if found:
        return found
    for candidate in (
        pathlib.Path(r"D:\jdk-21\bin\keytool.exe"),
        pathlib.Path(r"C:\Program Files\Java"),
    ):
        if candidate.is_file() and candidate.name == "keytool.exe":
            return str(candidate)
    java_home = pathlib.Path.home() / ".gradle"
    del java_home
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dir",
        default=str(DEFAULT_KEYSTORE_DIR),
        help="Where to keep the keystore (default: %(default)s)",
    )
    args = parser.parse_args()

    keystore_dir = pathlib.Path(args.dir).expanduser()
    keystore_path = keystore_dir / KEYSTORE_NAME

    if keystore_path.exists():
        print(f"A keystore already exists at {keystore_path}")
        print("Do not overwrite it — you need this exact key to publish updates.")
        print("Delete this file only if you are certain it is the wrong key.")
        return 1

    keytool = find_keytool()
    if keytool is None:
        print("Could not find keytool. Install a JDK (17 or newer) and retry,")
        print("or run this script from a terminal where keytool is on the PATH.")
        return 1

    keystore_dir.mkdir(parents=True, exist_ok=True)
    store_password = generate_password()
    # PKCS12 keystores — the default since JDK 9 — protect the private key
    # with the store password, so the key password must be identical.
    key_password = store_password

    command = [
        keytool,
        "-genkeypair",
        "-v",
        "-keystore",
        str(keystore_path),
        "-alias",
        ALIAS,
        "-keyalg",
        "RSA",
        "-keysize",
        "4096",
        "-validity",
        str(VALIDITY_DAYS),
        "-storepass",
        store_password,
        "-keypass",
        key_password,
        "-dname",
        "CN=Calculator, OU=Mobile, O=Imtty, L=Unknown, ST=Unknown, C=US",
    ]

    print("Generating a 4096-bit RSA release key...")
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        return result.returncode

    # Gradle reads the credentials from this file. It is git-ignored.
    properties = ROOT / "android" / "keystore.properties"
    properties.write_text(
        "\n".join(
            [
                "# Android release signing — LOCAL ONLY, never commit this file.",
                f"storeFile={keystore_path.as_posix()}",
                f"storePassword={store_password}",
                f"keyAlias={ALIAS}",
                f"keyPassword={key_password}",
                "",
            ]
        ),
        encoding="utf-8",
    )

    # A human-readable copy, kept next to the key and outside the repository.
    (keystore_dir / "SIGNING-CREDENTIALS.txt").write_text(
        "\n".join(
            [
                "Calculator — Android release signing credentials",
                "=" * 52,
                "",
                f"Keystore file : {keystore_path}",
                f"Key alias     : {ALIAS}",
                f"Store password: {store_password}",
                f"Key password  : {key_password}",
                "",
                "Back these up somewhere safe and private (an encrypted drive,",
                "a password manager's secure note, an offsite backup).",
                "If you lose this key you can never update the app on Google",
                "Play again — you would have to publish it under a new listing.",
                "",
                "These credentials are deliberately NOT in the git repository.",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print()
    print("Release signing key created.")
    print(f"  keystore : {keystore_path}")
    print(f"  alias    : {ALIAS}")
    print(f"  gradle   : {properties}  (git-ignored)")
    print(f"  backup   : {keystore_dir / 'SIGNING-CREDENTIALS.txt'}")
    print()
    print("Keep a private backup of both files before your first release.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
