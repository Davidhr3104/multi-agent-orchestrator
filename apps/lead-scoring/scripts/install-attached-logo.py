from pathlib import Path

from PIL import Image

assets = Path(
    r"C:\Users\devex\.cursor\projects\c-Users-devex-OneDrive-Im-genes-Documentos-multi-agent-orchestrator\assets"
)
matches = sorted(assets.glob("*title_helix_for_leads*f81a2255*"))
if not matches:
    matches = sorted(assets.glob("*title_helix_for_leads*"), key=lambda p: p.stat().st_mtime, reverse=True)
if not matches:
    raise SystemExit(f"no logo in {assets}")

src = matches[0]
print("src", src.name, src.stat().st_size)

pub = Path(r"C:\Users\devex\projects\helix-lead-scoring-template\apps\lead-scoring\public")
im = Image.open(src).convert("RGBA")
px = im.load()
w, h = im.size
print("size", im.size, "corners", px[0, 0], px[w - 1, h - 1])


def keep(r: int, g: int, b: int, a: int) -> bool:
    if a < 10:
        return False
    mx, mn = max(r, g, b), min(r, g, b)
    # baked checkerboard / light greys
    if mx - mn <= 28 and mn >= 40:
        return False
    if r >= 245 and g >= 245 and b >= 245:
        return False
    # black ink
    if mx <= 55 and mx - mn <= 25:
        return True
    # cobalt / cyan
    if b >= 70 and b >= r + 8 and (b >= g - 15 or g >= r + 5):
        return True
    if b > 90 and (mx - mn) >= 20 and b > r and b >= g - 10:
        return True
    if a > 200 and (mx - mn) > 28:
        return True
    return a > 128 and (mx - mn) > 15


out = Image.new("RGBA", im.size, (0, 0, 0, 0))
opx = out.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if keep(r, g, b, a):
            opx[x, y] = (r, g, b, 255 if a > 200 else a)

bbox = out.getbbox()
print("bbox", bbox)
cropped = out.crop(bbox)
pad = 4
final = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
final.paste(cropped, (pad, pad), cropped)
final.save(pub / "helix-leads-icon.png", optimize=True)
final.save(pub / "logo-icon.png", optimize=True)
print("saved", final.size, "corner", final.getpixel((0, 0)))

grey = 0
pxf = final.load()
fw, fh = final.size
for y in range(fh):
    for x in range(fw):
        r, g0, b, a = pxf[x, y]
        if a > 200 and max(r, g0, b) - min(r, g0, b) <= 15 and min(r, g0, b) >= 100:
            grey += 1
print("opaque grey", grey)
