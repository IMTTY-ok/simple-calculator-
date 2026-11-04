#!/usr/bin/env python3
"""Generate every brand and store asset for the Calculator app.

One source of truth for the visual language, so the launcher icon, the
adaptive icon, the splash screen, the PWA icons and the Play Store graphics
can never drift apart.

Outputs
-------
``public/icons/``              PWA / web icons
``public/splash/``             splash artwork used by the web build
``android/app/src/main/res/``  launcher icons (legacy + adaptive) and splash
``store-assets/``              Google Play listing graphics

Run from the project root::

    python scripts/generate_assets.py
"""

from __future__ import annotations

import pathlib
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Design tokens
# ---------------------------------------------------------------------------

BACKGROUND = (10, 11, 13, 255)
PLATE = (20, 22, 25, 255)
PLATE_EDGE = (44, 49, 57, 255)
KEY_OUTLINE = (238, 241, 245, 120)
ACCENT = (255, 122, 61, 255)
TEXT = (238, 241, 245, 255)
TEXT_MUTED = (139, 146, 156, 255)
TRANSPARENT = (0, 0, 0, 0)

WORDMARK = "CALCULATOR"
TAGLINE = "Fast. Precise. Offline."

MONO_FONT = pathlib.Path(r"C:\Windows\Fonts\consola.ttf")

#: Android launcher icon densities: directory suffix -> icon size in px.
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

#: Adaptive icon foregrounds are 108dp canvases; the visible glyph must stay
#: inside the central 66dp safe zone.
ADAPTIVE_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

#: Splash artwork, keyed by the res folder it belongs to.
SPLASH_SIZES = {
    "drawable": (480, 320),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
}


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------


def draw_keypad(
    draw: ImageDraw.ImageDraw,
    size: int,
    origin: float,
    span: float,
    stroke_ratio: float = 0.05,
    radius_ratio: float = 0.26,
) -> None:
    """Draw the app mark: four keys, three outlined and one accented.

    ``origin`` and ``span`` are fractions of the canvas.
    """
    gap = span * 0.10
    key = (span - gap) / 2
    stroke = max(2, int(size * span * stroke_ratio))
    radius = int(key * size * radius_ratio)

    cells = (
        (origin, origin),
        (origin + key + gap, origin),
        (origin, origin + key + gap),
        (origin + key + gap, origin + key + gap),
    )

    for index, (x, y) in enumerate(cells):
        left, top = x * size, y * size
        right, bottom = left + key * size, top + key * size
        if index == 3:
            draw.rounded_rectangle([left, top, right, bottom], radius=radius, fill=ACCENT)
        else:
            draw.rounded_rectangle(
                [left, top, right, bottom],
                radius=radius,
                outline=KEY_OUTLINE,
                width=stroke,
            )


def load_mono(size: int) -> ImageFont.FreeTypeFont:
    """Load the mono typeface used for the wordmark."""
    return ImageFont.truetype(str(MONO_FONT), size)


def draw_wordmark(
    draw: ImageDraw.ImageDraw,
    center_x: float,
    top: float,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    tracking: float,
) -> float:
    """Draw uppercase, letter-spaced text centred on ``center_x``.

    Returns the width of the rendered text.
    """
    widths = [draw.textlength(char, font=font) for char in text]
    total = sum(widths) + tracking * (len(text) - 1)

    x = center_x - total / 2
    for char, width in zip(text, widths):
        draw.text((x, top), char, font=font, fill=fill)
        x += width + tracking
    return total


def draw_plate(
    draw: ImageDraw.ImageDraw,
    size: int,
    margin_ratio: float = 0.08,
    radius_ratio: float = 0.22,
) -> None:
    """Draw the subtle rounded plate that sits behind the mark."""
    margin = int(size * margin_ratio)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=PLATE,
        outline=PLATE_EDGE,
        width=max(1, int(size * 0.012)),
    )


def app_icon(size: int, plate: bool = True, transparent: bool = False) -> Image.Image:
    """The square app icon used on the web and as the legacy launcher icon.

    ``transparent`` leaves the area outside the plate clear, so the icon can
    be composited onto another background without showing a square edge.
    """
    base = TRANSPARENT if transparent else BACKGROUND
    image = Image.new("RGBA", (size, size), base)
    draw = ImageDraw.Draw(image)
    if plate:
        draw_plate(draw, size)
        draw_keypad(draw, size, origin=0.22, span=0.56, stroke_ratio=0.045)
    elif transparent:
        draw_keypad(draw, size, origin=0.24, span=0.52, stroke_ratio=0.05)
    else:
        # Full-bleed variant for the Play Store (Google applies its own mask).
        draw_keypad(draw, size, origin=0.24, span=0.52, stroke_ratio=0.05)
    return image


def adaptive_foreground(size: int) -> Image.Image:
    """The adaptive-icon foreground: the mark inside the 66dp safe zone."""
    image = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    # 66/108 of the canvas is the guaranteed-visible area.
    draw_keypad(draw, size, origin=0.185, span=0.63, stroke_ratio=0.055)
    return image


def round_icon(size: int) -> Image.Image:
    """A circular legacy launcher icon."""
    image = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    draw.ellipse([0, 0, size - 1, size - 1], fill=PLATE)
    inner = int(size * 0.16)
    draw_keypad(draw, size, origin=0.22, span=0.56, stroke_ratio=0.045)
    # Re-mask to a circle so the transparent corners stay clean.
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    image.putalpha(mask)
    del inner
    return image


def splash_image(width: int, height: int) -> Image.Image:
    """The launch screen: graphite background, mark and wordmark."""
    image = Image.new("RGBA", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(image)

    short = min(width, height)
    mark_size = int(short * 0.34)
    mark = app_icon(mark_size, plate=False)
    image.alpha_composite(mark, (int((width - mark_size) / 2), int(height / 2 - mark_size * 0.78)))

    font_size = max(14, int(short * 0.062))
    font = load_mono(font_size)
    wordmark_top = int(height / 2 + mark_size * 0.28)
    draw_wordmark(draw, width / 2, wordmark_top, WORDMARK, font, TEXT, font_size * 0.34)

    tagline_font = load_mono(max(10, int(font_size * 0.62)))
    draw_wordmark(
        draw,
        width / 2,
        wordmark_top + int(font_size * 1.75),
        TAGLINE,
        tagline_font,
        TEXT_MUTED,
        tagline_font.size * 0.28,
    )
    return image


def feature_graphic(width: int = 1024, height: int = 500) -> Image.Image:
    """The Google Play feature graphic (1024 x 500)."""
    from PIL import ImageFilter

    image = Image.new("RGBA", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(image)

    mark_size = int(height * 0.44)
    title_font = load_mono(int(height * 0.115))
    tagline_font = load_mono(int(height * 0.058))

    title_width = draw.textlength(WORDMARK, font=title_font)
    tagline_width = draw.textlength(TAGLINE, font=tagline_font)
    text_width = max(title_width, tagline_width)
    gap = int(height * 0.14)

    group_width = mark_size + gap + text_width
    group_left = (width - group_width) / 2
    mark_top = (height - mark_size) / 2

    # A soft accent glow behind the mark.
    glow = Image.new("RGBA", (width, height), TRANSPARENT)
    glow_draw = ImageDraw.Draw(glow)
    radius = int(mark_size * 0.95)
    glow_draw.ellipse(
        [
            group_left + mark_size / 2 - radius,
            height / 2 - radius,
            group_left + mark_size / 2 + radius,
            height / 2 + radius,
        ],
        fill=(255, 122, 61, 46),
    )
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(70)))

    mark = app_icon(mark_size, plate=True, transparent=True)
    image.alpha_composite(mark, (int(group_left), int(mark_top)))

    text_left = group_left + mark_size + gap
    draw.text((text_left, height * 0.36), WORDMARK, font=title_font, fill=TEXT)
    draw.text((text_left, height * 0.56), TAGLINE, font=tagline_font, fill=TEXT_MUTED)

    return image.convert("RGB")


# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------


def save(image: Image.Image, path: pathlib.Path, rgb: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if rgb:
        image = image.convert("RGB")
    image.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}")


def write_web_icons() -> None:
    print("Web / PWA icons")
    icons = ROOT / "public" / "icons"
    save(app_icon(192), icons / "pwa-192x192.png")
    save(app_icon(512), icons / "pwa-512x512.png")
    save(app_icon(512, plate=False), icons / "pwa-maskable-512x512.png")
    save(app_icon(180), icons / "apple-touch-icon.png")
    save(app_icon(1024), icons / "icon-1024.png")
    save(app_icon(32), icons / "favicon-32.png")


def write_splash() -> None:
    print("Web splash")
    splash = ROOT / "public" / "splash"
    save(splash_image(2732, 2732), splash / "splash-2732.png")
    save(splash_image(1280, 1920), splash / "splash-1280x1920.png")


def write_android_icons() -> None:
    print("Android launcher icons")
    res = ROOT / "android" / "app" / "src" / "main" / "res"
    for density, size in DENSITIES.items():
        folder = res / f"mipmap-{density}"
        save(app_icon(size), folder / "ic_launcher.png")
        save(round_icon(size), folder / "ic_launcher_round.png")
    for density, size in ADAPTIVE_SIZES.items():
        folder = res / f"mipmap-{density}"
        save(adaptive_foreground(size), folder / "ic_launcher_foreground.png")


def write_android_splash() -> None:
    print("Android splash screens")
    res = ROOT / "android" / "app" / "src" / "main" / "res"
    for folder, (width, height) in SPLASH_SIZES.items():
        save(splash_image(width, height), res / folder / "splash.png", rgb=True)


def write_store_assets() -> None:
    print("Google Play store assets")
    store = ROOT / "store-assets"
    save(app_icon(512, plate=False), store / "icon" / "icon-512.png")
    save(feature_graphic(), store / "feature-graphic" / "feature-graphic-1024x500.png", rgb=True)
    save(splash_image(2732, 2732), store / "splash" / "splash-2732.png")


def main() -> None:
    write_web_icons()
    write_splash()
    write_android_icons()
    write_android_splash()
    write_store_assets()
    print("\nAll assets generated.")


if __name__ == "__main__":
    main()
