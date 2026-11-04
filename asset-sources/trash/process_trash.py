"""v3 (4 Kategorien, strikte Draufsicht). Cut the generated magenta-keyed trash sheets into transparent sprites.
Usage: python3 asset-sources/trash/process_trash.py  (run from repo root)
Steps per sheet: chroma alpha from magenta-ness (min(R,B)-G), colour un-mixing
against the sheet's background colour (removes magenta fringe), edge despill,
per-cell largest-component extraction, trim, fit into 256x256 (@2x) PNG."""
import json, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SHEETS = json.load(open('asset-sources/trash/metadata.json'))['sheets']
LO, HI, SIZE, PAD = 38.0, 150.0, 256, 10

def key(rgb, bg):
    f = rgb.astype(np.float32)
    m = np.minimum(f[..., 0], f[..., 2]) - f[..., 1]
    # v3: dunklere/pinkere Hintergründe (z. B. #E8007A) auf volle Magenta-Stärke normieren
    mbg = float(min(bg[0], bg[2]) - bg[1])
    m = m * max(1.0, 240.0 / max(mbg, 1.0))
    a = 1.0 - np.clip((m - LO) / (HI - LO), 0, 1)
    a = ndimage.median_filter(a, 3)
    # un-mix: observed = a*C + (1-a)*bg  ->  C = (obs-(1-a)bg)/a
    safe = np.maximum(a, 1e-3)[..., None]
    c = (f - (1 - a[..., None]) * bg[None, None, :]) / safe
    c = np.clip(c, 0, 255)
    # residual spill on soft edge pixels
    # global magenta despill (no sprite is genuinely magenta/purple)
    spill = np.clip(np.minimum(c[..., 0], c[..., 2]) - c[..., 1] - 12, 0, None)
    soft = np.where(a < .98, 1.0, .85)
    c[..., 0] -= spill * soft
    c[..., 2] -= spill * soft
    # very soft edge pixels: take colour from nearby solid pixels (no keyed garbage)
    w = (a > .6).astype(np.float32)
    num = np.stack([ndimage.gaussian_filter(c[..., i] * w, 2.5) for i in range(3)], -1)
    den = ndimage.gaussian_filter(w, 2.5)[..., None]
    fill = num / np.maximum(den, 1e-4)
    t = np.clip((a - .15) / .45, 0, 1)[..., None]
    c = np.where(den > 1e-3, c * t + fill * (1 - t), c)
    # slightly tighten the soft edge so no keyed rim survives
    a = np.clip((a - .06) / .94, 0, 1)
    return np.clip(c, 0, 255), a

def run():
    meta = []
    for sh in SHEETS:
        img = np.asarray(Image.open(sh['file']).convert('RGB'))
        h, w, _ = img.shape
        corners = np.concatenate([img[:24, :24].reshape(-1, 3), img[:24, -24:].reshape(-1, 3),
                                  img[-24:, :24].reshape(-1, 3), img[-24:, -24:].reshape(-1, 3)])
        bg = np.median(corners, 0).astype(np.float32)
        col, a = key(img, bg)
        cols, rows = sh['grid']
        lab, n = ndimage.label(a > .5)
        sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        cents = ndimage.center_of_mass(np.ones_like(a), lab, range(1, n + 1))
        def keepmask(cx, cy):
            ids = [j + 1 for j, (sz, (yy, xx)) in enumerate(zip(sizes, cents))
                   if sz >= 60 and int(xx * cols // w) == cx and int(yy * rows // h) == cy]
            if not ids: raise SystemExit('empty cell')
            big = max(sizes[i - 1] for i in ids)
            ids = [i for i in ids if sizes[i - 1] >= big * .02]
            return ndimage.binary_dilation(np.isin(lab, ids), iterations=3)
        for i, item in enumerate(sh['items']):
            if item is None: continue  # abgelehnte Zelle (falsche Perspektive), siehe metadata 'rejected'
            cx, cy = i % cols, i // cols
            x0, y0 = 0, 0
            # components of the whole sheet, assigned to this cell by centroid
            ca = a * keepmask(cx, cy)
            ys, xs = np.nonzero(ca > .02)
            ty0, ty1, tx0, tx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            rgba = np.dstack([col, ca[..., None] * 255])[ty0:ty1, tx0:tx1].astype(np.uint8)
            spr = Image.fromarray(rgba, 'RGBA')
            s = (SIZE - 2 * PAD) / max(spr.size)
            spr = spr.resize((max(1, round(spr.size[0] * s)), max(1, round(spr.size[1] * s))), Image.LANCZOS)
            out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
            out.alpha_composite(spr, ((SIZE - spr.size[0]) // 2, (SIZE - spr.size[1]) // 2))
            # premultiplied-safe: zero colour where fully transparent
            o = np.asarray(out).copy(); o[o[..., 3] == 0, :3] = 0
            name = f"assets/trash/{item['category']}-{item['name']}.png"
            Image.fromarray(o, 'RGBA').save(name, optimize=True)
            meta.append({**item, 'file': name, 'sheet': sh['file'], 'cell': [cx, cy],
                         'sourceSize': [int(tx1 - tx0), int(ty1 - ty0)], 'scale': round(s, 3)})
            print(name, spr.size)
    json.dump(meta, open('asset-sources/trash/sprites.json', 'w'), indent=1, ensure_ascii=False)

if __name__ == '__main__':
    run()
