"""Strip baked checkerboard from Helix Leads logos and crop tight."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

PUB = Path(r"C:\Users\devex\projects\helix-lead-scoring-template\apps\lead-scoring\public")
ICON_SRC = Path(
    r"C:\Users\devex\Downloads\Helix logos\title_helix_for_leads_electric_cobalt_cyan_logo_visual_structure_identical_to.png"
)
WM_SRC = Path(
    r"C:\Users\devex\Downloads\title_helix_for_leads_electric_cobalt_cyan_logo_visual_structure_identical_to.png"
)


def keep_logo_pixel(r: int, g: int, b: int) -> bool:
    """Keep electric cobalt/cyan mark + black wordmark ink; drop greys."""
    mx, mn = max(r, g, b), min(r, g, b)
    chroma = mx - mn

    # Baked checkerboard / paper / light greys
    if chroma <= 28 and mn >= 40:
        return False
    if r >= 245 and g >= 245 and b >= 245:
        return False

    # Near-black ink (wordmark text)
    if mx <= 55 and chroma <= 25:
        return True

    # Blue / cyan helix + funnel (dominant blue or cyan)
    if b >= 70 and b >= r + 8 and (b >= g - 15 or g >= r + 5):
        return True

    # Soft glow fringe: bluish midtones
    if b > 90 and chroma >= 20 and b > r and b >= g - 10:
        return True

    return False


def process(src: Path, pad: int = 6) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if keep_logo_pixel(r, g, b):
                px[x, y] = (r, g, b, 255)
            else:
                px[x, y] = (0, 0, 0, 0)

    bbox = im.getbbox()
    if not bbox:
        raise SystemExit(f"empty after key: {src}")
    cropped = im.crop(bbox)

    # Second pass: drop residual checkerboard islands by eroding low-chroma edge
    px2 = cropped.load()
    cw, ch = cropped.size
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = px2[x, y]
            if a == 0:
                continue
            if max(r, g, b) - min(r, g, b) <= 20 and min(r, g, b) >= 80:
                px2[x, y] = (0, 0, 0, 0)

    bbox2 = cropped.getbbox() or (0, 0, cw, ch)
    cropped = cropped.crop(bbox2)

    out = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
    out.paste(cropped, (pad, pad), cropped)
    return out


def stats(im: Image.Image, label: str) -> None:
    px = im.load()
    w, h = im.size
    opaque = greyish = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            opaque += 1
            if max(r, g, b) - min(r, g, b) <= 20 and min(r, g, b) >= 60:
                greyish += 1
    print(label, im.size, "opaque~", opaque, "greyish~", greyish, "corner", px[0, 0])


icon = process(ICON_SRC, pad=4)
icon.save(PUB / "helix-leads-icon.png", optimize=True)
icon.save(PUB / "logo-icon.png", optimize=True)
stats(icon, "icon")

wm = process(WM_SRC, pad=12)
wm.save(PUB / "helix-leads-wordmark.png", optimize=True)
wm.save(PUB / "helix-for-leads.png", optimize=True)
stats(wm, "wordmark")

# Preview on dark bg for QA
preview = Image.new("RGBA", (icon.width + 40, icon.height + 40), (17, 19, 25, 255))
preview.paste(icon, (20, 20), icon)
preview.convert("RGB").save(PUB / "_logo-preview-dark.jpg", quality=90)
print("wrote preview")
