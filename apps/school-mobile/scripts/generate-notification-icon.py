"""White-on-transparent crest for Android status-bar / notification small icon.

Android tints this asset as a silhouette, so yellow/green fills are punched out
and only the badge ring, cross, book, lamp, and banner remain white.
"""
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
src = root.parent.parent / "apps/web/public/school-sis/st-lukes-logo.png"
out = root / "assets" / "notification-icon.png"

img = Image.open(src).convert("RGBA")
pixels = []
for r, g, b, a in img.getdata():
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    bg = a < 16 or lum < 22
    yellow = r > 180 and g > 150 and b < 100
    lime = g > 130 and 40 < r < 210 and b < 120 and lum > 95
    if bg or yellow or lime:
        pixels.append((255, 255, 255, 0))
    else:
        pixels.append((255, 255, 255, 255))
img.putdata(pixels)
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)
side = max(img.size) + 28
canvas = Image.new("RGBA", (side, side), (255, 255, 255, 0))
canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
canvas.resize((96, 96), Image.Resampling.LANCZOS).save(out, "PNG")
print(out)
