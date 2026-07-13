# Re-clean the MJ bubble sprites (Damla, 13 Tem night: "arkalar iyi temizlenmemis").
# The old pass was a crude chroma-key: invisible on the dark theme, dirty fringes on light.
# This pass builds a real body mask and kills everything outside it:
#   core  = clearly-ivory pixels -> flood-fill from the borders marks the true OUTSIDE
#   body  = everything not outside (so interior dark stipple ART survives)
#   outside fringe, floating specks and the baked black shadow are erased
#   edge band: dark-rim alpha ramp + unpremultiply-against-black removes the halo
# numpy only (no scipy on this machine). Usage: python3 tools/clean_bubbles.py

import glob
import os
import numpy as np
from PIL import Image

DIR = os.path.join(os.path.dirname(__file__), '..', 'web', 'assets', 'bubbles')


def grow(m, it=1):
    for _ in range(it):
        p = np.pad(m, 1)
        m = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
             | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:] | p[1:-1, 1:-1])
    return m


def flood_outside(free):
    out = np.zeros_like(free)
    out[0, :] = free[0, :]
    out[-1, :] = free[-1, :]
    out[:, 0] |= free[:, 0]
    out[:, -1] |= free[:, -1]
    while True:
        grown = grow(out) & free
        if (grown == out).all():
            return out
        out = grown


def speckle_score(rgb, a, body_er):
    # what reads as dirt on a white page: visible-ish dark pixels outside the safe interior
    lum = rgb.mean(2)
    return int(((a > 60) & (lum < 60) & ~body_er).sum())


def clean(path):
    im = np.array(Image.open(path).convert('RGBA'))
    rgb = im[..., :3].astype(float)
    a = im[..., 3].astype(float)
    lum = rgb.mean(2)

    core = (a > 200) & (lum > 110)            # unmistakably bubble ivory
    core = grow(core, 1)                       # close pinholes in the grain
    outside = flood_outside(~core)
    body = ~outside                            # core + enclosed stipple/shadow art
    body = grow(body, 2)                       # margin so anti-aliased edges survive
    er = ~grow(~body, 4)                       # eroded interior (protected zone)
    band = body & ~er

    before = speckle_score(rgb, a, er)

    a2 = np.where(body, a, 0.0)
    ramp = np.clip((lum - 25.0) / 70.0, 0.0, 1.0)
    a2 = np.where(band, a2 * ramp, a2)
    # unpremultiply the edge band against the black it was shot on -> no dark halo
    az = np.clip(a / 255.0, 1e-3, 1.0)[..., None]
    rgb2 = np.where(band[..., None], np.clip(rgb / az, 0, 255), rgb)
    # soft 3x3 feather on the band alpha
    p = np.pad(a2, 1)
    blur = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + p[1:-1, 1:-1]
            + p[:-2, :-2] + p[:-2, 2:] + p[2:, :-2] + p[2:, 2:]) / 9.0
    a2 = np.where(band, blur, a2)

    out = np.dstack([np.clip(rgb2, 0, 255).astype(np.uint8), np.clip(a2, 0, 255).astype(np.uint8)])
    after = speckle_score(out[..., :3].astype(float), out[..., 3].astype(float), er)
    Image.fromarray(out, 'RGBA').save(path)
    return before, after


if __name__ == '__main__':
    total_b = total_a = 0
    for f in sorted(glob.glob(os.path.join(DIR, 'b*.png'))):
        b, aft = clean(f)
        total_b += b
        total_a += aft
        print(f"{os.path.basename(f)}: kirli piksel {b} -> {aft}")
    print(f"TOPLAM: {total_b} -> {total_a}")
