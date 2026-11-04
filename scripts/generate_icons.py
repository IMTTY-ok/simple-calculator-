#!/usr/bin/env python3
"""Generate the Calculator PWA icons.

Draws the app mark — a four-key keypad glyph with one accented key — on the
app's graphite background. Run from the project root:

    python scripts/generate_icons.py

Requires Pillow (``pip install pillow``).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

BACKGROUND = (10, 11, 13, 255)
PLATE = (20, 22, 25, 255)
PLATE_EDGE = (38, 42, 49, 255)
KEY_OUTLINE = (238, 241, 245, 128)
ACCENT = (255, 122, 61, 255)


def draw_keypad(draw: ImageDraw.ImageDraw, size: int, origin: float, span: float) -> None:
    """Draw the four-key keypad glyph inside the given box.

    ``origin`` and ``span`` are fractions of the icon box: the glyph occupies
    a square region of side ``span`` starting at ``origin``.
    """
    gap = span * 0.10
    key = (span - gap) / 2
    stroke = max(2, int(size * span * 0.045))
    radius = int(key * size * 0.26)

    cells = [
        (origin, origin),
        (origin + key + gap, origin),
        (origin, origin + key + gap),
        (origin + key + gap, origin + key + gap),
    ]

    for index, (x, y) in enumerate(cells):
        left = x * size
        top = y * size
        right = left + key * size
        bottom = top + key * size
        if index == 3:
            draw.rounded_rectangle([left, top, right, bottom], radius=radius, fill=ACCENT)
        else:
            draw.rounded_rectangle(
                [left, top, right, bottom],
                radius=radius,
                outline=KEY_OUTLINE,
                width=stroke,
            )


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    """Render one icon."""
    image = Image.new("RGBA", (size, size), BACKGROUND)
    draw = ImageDraw.Draw(image)

    if maskable:
        # Maskable icons need a solid background so the platform can crop them.
        draw_keypad(draw, size, origin=0.19, span=0.62)
    else:
        # A subtle rounded plate behind the mark.
        margin = int(size * 0.08)
        radius = int(size * 0.22)
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=radius,
            fill=PLATE,
            outline=PLATE_EDGE,
            width=max(1, int(size * 0.012)),
        )
        draw_keypad(draw, size, origin=0.14, span=0.72)

    return image


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)

    outputs = {
        "pwa-192x192.png": (192, False),
        "pwa-512x512.png": (512, False),
        "pwa-maskable-512x512.png": (512, True),
        "apple-touch-icon.png": (180, False),
        "icon-1024.png": (1024, False),
    }

    for name, (size, maskable) in outputs.items():
        path = PUBLIC / name
        make_icon(size, maskable).save(path, "PNG", optimize=True)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
