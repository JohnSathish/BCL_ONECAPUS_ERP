"""Build Play/Android launcher icons from the college seal (icon-source.png)."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parents[1] / "assets"
SRC = ASSETS / "icon-source.png"
STORE = ASSETS / "store"
PREVIEW = ASSETS / "icon-previews"

CANVAS = 1024
SAFE_RATIO = 66 / 108  # Android adaptive-icon safe zone
ADAPTIVE_SCALE = 0.88
# Match Expo splash / adaptive background in app.config.ts
BRAND_PURPLE = (38, 18, 101)  # #261265


def flood_fill_dark_corners(
    img: Image.Image, fill: tuple[int, int, int], tolerance: int = 28
) -> Image.Image:
    """Replace near-black studio background with a solid plate color."""
    out = img.copy()
    p = out.load()
    ww, hh = out.size
    seen = bytearray(ww * hh)

    def dark(c: tuple[int, ...]) -> bool:
        return c[0] <= tolerance and c[1] <= tolerance and c[2] <= tolerance

    def bfs(sx: int, sy: int) -> None:
        if not dark(p[sx, sy]):
            return
        q = deque([(sx, sy)])
        seen[sy * ww + sx] = 1
        while q:
            x, y = q.popleft()
            if not dark(p[x, y]):
                continue
            p[x, y] = (*fill, 255)
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                idx = ny * ww + nx
                if 0 <= nx < ww and 0 <= ny < hh and not seen[idx]:
                    seen[idx] = 1
                    q.append((nx, ny))

    for sx, sy in ((0, 0), (ww - 1, 0), (0, hh - 1), (ww - 1, hh - 1)):
        bfs(sx, sy)
    return out


def is_metallic_gold(c: tuple[int, ...]) -> bool:
    r, g, b = c[0], c[1], c[2]
    return r >= 140 and g >= 90 and r >= g - 8 and g >= b + 12 and b <= 190 and (r + g) >= 260


def strip_outer_gold_frame(img: Image.Image, fill: tuple[int, int, int]) -> Image.Image:
    """Paint out a designed gold squircle rim so Android can apply its own mask."""
    out = img.copy()
    p = out.load()
    ww, hh = out.size
    seen = bytearray(ww * hh)
    seeds = [
        (0, hh // 2),
        (ww - 1, hh // 2),
        (ww // 2, 0),
        (ww // 2, hh - 1),
    ]

    def bfs(sx: int, sy: int) -> None:
        start = p[sx, sy]
        if not is_metallic_gold(start):
            return
        q = deque([(sx, sy)])
        seen[sy * ww + sx] = 1
        while q:
            x, y = q.popleft()
            if not is_metallic_gold(p[x, y]):
                continue
            p[x, y] = (*fill, 255)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    idx = ny * ww + nx
                    if 0 <= nx < ww and 0 <= ny < hh and not seen[idx]:
                        seen[idx] = 1
                        q.append((nx, ny))

    for sx, sy in seeds:
        bfs(sx, sy)

    mask = Image.new("L", (ww, hh), 0)
    draw = ImageDraw.Draw(mask)
    inset = 18
    radius = int(ww * 0.28)
    draw.rounded_rectangle(
        (inset, inset, ww - 1 - inset, hh - 1 - inset), radius=radius, fill=255
    )
    overlay = Image.new("RGBA", (ww, hh), (*fill, 255))
    return Image.composite(out, overlay, mask)


def plate_looks_white(img: Image.Image) -> bool:
    px = img.load()
    w, h = img.size
    samples: list[tuple[int, int, int]] = []
    for x, y in (
        (int(w * 0.08), int(h * 0.08)),
        (int(w * 0.92), int(h * 0.08)),
        (int(w * 0.08), int(h * 0.92)),
        (int(w * 0.92), int(h * 0.92)),
        (int(w * 0.12), int(h * 0.50)),
    ):
        r, g, b, *_ = px[x, y]
        if r > 40 or g > 40 or b > 40:
            samples.append((r, g, b))
    if not samples:
        return True
    avg = tuple(sum(c[i] for c in samples) // len(samples) for i in range(3))
    return avg[0] > 180 and avg[1] > 180 and avg[2] > 180


def apply_mask(fg: Image.Image, bg: tuple[int, int, int], kind: str, size: int = 432) -> Image.Image:
    bg_layer = Image.new("RGBA", (CANVAS, CANVAS), (*bg, 255))
    composed = Image.alpha_composite(bg_layer, fg).resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    if kind == "circle":
        draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    elif kind == "squircle":
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.33), fill=255)
    elif kind == "rounded":
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.18), fill=255)
    else:
        draw.rectangle((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (245, 245, 248, 255))
    out.paste(composed, (0, 0), mask)
    return out


def with_safe_zone(img: Image.Image, size: int = 432) -> Image.Image:
    overlay = img.convert("RGBA")
    draw = ImageDraw.Draw(overlay)
    box = int(round(size * SAFE_RATIO))
    origin = (size - box) // 2
    draw.rectangle((origin, origin, origin + box, origin + box), outline=(0, 255, 128, 200), width=2)
    radius = box // 2
    cx = cy = size // 2
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=(255, 80, 80, 200), width=2)
    return overlay


def update_feature_graphic(seal_rgb: Image.Image) -> None:
    """Swap the seal on the existing 1024×500 Play feature graphic."""
    path = STORE / "feature-graphic.png"
    if not path.exists():
        print("skip feature-graphic (missing)")
        return
    banner = Image.open(path).convert("RGBA")
    # Existing layout places the crest upper-left (~120px diameter).
    crest = seal_rgb.resize((168, 168), Image.Resampling.LANCZOS).convert("RGBA")
    # Soft circular crop so white plate corners do not cover banner art.
    mask = Image.new("L", crest.size, 0)
    ImageDraw.Draw(mask).ellipse((4, 4, crest.size[0] - 5, crest.size[1] - 5), fill=255)
    crest.putalpha(mask)
    x, y = 56, 72
    banner.paste(crest, (x, y), crest)
    banner.convert("RGB").save(path, "PNG", optimize=True)
    print("wrote", path)


def main() -> None:
    STORE.mkdir(exist_ok=True)
    PREVIEW.mkdir(exist_ok=True)

    if not SRC.exists():
        raise SystemExit(f"Missing source seal: {SRC}")

    src = Image.open(SRC).convert("RGBA")
    if src.size != (CANVAS, CANVAS):
        src = src.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS)

    # Studio exports often sit on pure black; replace with brand purple for splash/launcher.
    cleaned = flood_fill_dark_corners(src, BRAND_PURPLE)
    white_plate = plate_looks_white(cleaned)
    print("white_plate", white_plate)

    # Adaptive foreground: keep seal, drop outer decorative squircle when present.
    adaptive_plate = strip_outer_gold_frame(cleaned, BRAND_PURPLE)

    full_rgb = Image.new("RGB", (CANVAS, CANVAS), BRAND_PURPLE)
    full_rgb.paste(cleaned, mask=cleaned.split()[-1])
    icon_path = ASSETS / "icon.png"
    full_rgb.save(icon_path, "PNG", optimize=True)
    print("wrote", icon_path)

    # In-app circular avatar fallback (same seal).
    default_logo = ASSETS / "college-logo-default.png"
    full_rgb.save(default_logo, "PNG", optimize=True)
    print("wrote", default_logo)

    fg = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    art_size = int(round(CANVAS * ADAPTIVE_SCALE))
    art = adaptive_plate.resize((art_size, art_size), Image.Resampling.LANCZOS)
    offset = (CANVAS - art_size) // 2
    fg.paste(art, (offset, offset), art)
    adaptive_path = ASSETS / "adaptive-icon.png"
    fg.save(adaptive_path, "PNG", optimize=True)
    print("wrote", adaptive_path, "art", art_size, "offset", offset)

    play = full_rgb.resize((512, 512), Image.Resampling.LANCZOS)
    play_path = STORE / "icon-512.png"
    play.save(play_path, "PNG", optimize=True)
    print("wrote", play_path)

    update_feature_graphic(full_rgb)

    previews = {
        "preview-circle.png": apply_mask(fg, BRAND_PURPLE, "circle"),
        "preview-squircle.png": apply_mask(fg, BRAND_PURPLE, "squircle"),
        "preview-rounded.png": apply_mask(fg, BRAND_PURPLE, "rounded"),
        "preview-square.png": apply_mask(fg, BRAND_PURPLE, "square"),
        "preview-safezone.png": with_safe_zone(apply_mask(fg, BRAND_PURPLE, "square")),
        "preview-full-icon.png": full_rgb.resize((432, 432), Image.Resampling.LANCZOS),
    }
    for name, im in previews.items():
        path = PREVIEW / name
        im.save(path, "PNG")
        print("preview", name)

    print("BG_HEX=#%02X%02X%02X" % BRAND_PURPLE)
    print("ADAPTIVE_SCALE", ADAPTIVE_SCALE)


if __name__ == "__main__":
    main()
