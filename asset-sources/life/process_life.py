"""Freistellen der Meeresleben-Bögen (Magenta) zu 256-px-Sprites.
Aufruf vom Repo-Root: python3 asset-sources/life/process_life.py
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SHEETS = json.loads((ROOT / 'asset-sources/life/metadata.json').read_text())['sheets']
LO, HI, SIZE, PAD = 38.0, 150.0, 256, 12

def key(rgb, bg):
    f = rgb.astype(np.float32)
    m = np.minimum(f[..., 0], f[..., 2]) - f[..., 1]
    mbg = float(min(bg[0], bg[2]) - bg[1])
    m = m * max(1.0, 240.0 / max(mbg, 1.0))
    a = 1.0 - np.clip((m - LO) / (HI - LO), 0, 1)
    a = ndimage.median_filter(a, 3)
    safe = np.maximum(a, 1e-3)[..., None]
    c = (f - (1 - a[..., None]) * bg[None, None, :]) / safe
    c = np.clip(c, 0, 255)
    spill = np.clip(np.minimum(c[..., 0], c[..., 2]) - c[..., 1] - 12, 0, None)
    soft = np.where(a < .98, 1.0, .85)
    c[..., 0] -= spill * soft
    c[..., 2] -= spill * soft
    a = np.clip((a - .06) / .94, 0, 1)
    return np.clip(c, 0, 255), a

def main():
    out_meta = []
    for sh in SHEETS:
        img = np.asarray(Image.open(ROOT / sh['file']).convert('RGB'))
        h, w, _ = img.shape
        corners = np.concatenate([
            img[:20, :20].reshape(-1, 3), img[:20, -20:].reshape(-1, 3),
            img[-20:, :20].reshape(-1, 3), img[-20:, -20:].reshape(-1, 3)])
        bg = np.median(corners, 0).astype(np.float32)
        col, a = key(img, bg)
        lab, n = ndimage.label(a > .45)
        if n < 1:
            raise SystemExit('leer: ' + sh['file'])
        sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        mask = ndimage.binary_dilation(lab == keep, iterations=2)
        ca = a * mask
        ys, xs = np.nonzero(ca > .02)
        rgba = np.dstack([col, ca[..., None] * 255])[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8)
        spr = Image.fromarray(rgba, 'RGBA')
        s = (SIZE - 2 * PAD) / max(spr.size)
        spr = spr.resize((max(1, round(spr.size[0] * s)), max(1, round(spr.size[1] * s))), Image.LANCZOS)
        out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        out.alpha_composite(spr, ((SIZE - spr.size[0]) // 2, (SIZE - spr.size[1]) // 2))
        o = np.asarray(out).copy()
        o[o[..., 3] == 0, :3] = 0
        dest = ROOT / sh['out']
        dest.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(o, 'RGBA').save(dest, optimize=True)
        out_meta.append({**sh, 'bytes': dest.stat().st_size})
        print(sh['out'], dest.stat().st_size)
    (ROOT / 'asset-sources/life/sprites.json').write_text(json.dumps(out_meta, indent=2) + '\n')

if __name__ == '__main__':
    main()
