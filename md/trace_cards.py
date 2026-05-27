"""Auto-trace every option crop into an SVG via potrace.

Reads each `app/public/cards/options/NN_X_optK.jpg` and writes
`app/public/cards/vectors/NN_X_optK.svg`. The SVG is the rasterised
card's dark linework converted to one or more <path> elements with
stroke = white (so it stacks cleanly on the blueprint background).

Runtime is small enough (≈ 130 images) to re-run on demand. Tunables
near the top of the file control thresholding + tracing fidelity.

Run from repo root:
    python md/trace_cards.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageOps

# ── Tunables ────────────────────────────────────────────────────────
THRESHOLD = 128         # 0–255; pixels darker than this become "ink".
TURDSIZE = 2            # Drop tiny noise speckles smaller than N pixels.
ALPHAMAX = 1.0          # Curve smoothing (0 = sharp polygon, 1.34 = max bezier).
OPTTOLERANCE = 0.2      # Allowed deviation when fitting beziers.
SCALE_TO = 400          # Resize the long edge of each crop before tracing (px).

# Output style.
STROKE_COLOR = "rgba(255,255,255,0.92)"
STROKE_WIDTH = 1.5       # In SVG user units (which match the traced pixel
                         # space, i.e. SCALE_TO across the long edge).
# fill=none keeps the trace as pure linework — closed shapes show their
# outlines only. Switch to a low-alpha white like "rgba(255,255,255,0.10)"
# if you want filled regions (e.g. on per-card overrides).
FILL_COLOR = "none"

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "app" / "public" / "cards" / "options"
OUT_DIR = ROOT / "app" / "public" / "cards" / "vectors"


def trace_image(src: Path, dst: Path) -> tuple[int, int]:
    """Trace a single crop and write its SVG. Returns (width, height) of
    the resized image in pixels (= the SVG user-space dimensions)."""
    img = Image.open(src).convert("L")  # grayscale

    # Resize so the long edge = SCALE_TO. Keeps aspect ratio so we don't
    # distort the card.
    w, h = img.size
    if w >= h:
        new_w = SCALE_TO
        new_h = max(1, round(h * SCALE_TO / w))
    else:
        new_h = SCALE_TO
        new_w = max(1, round(w * SCALE_TO / h))
    img = img.resize((new_w, new_h), Image.LANCZOS)

    # Threshold to B&W. Ink = darker than THRESHOLD.
    arr = np.asarray(img)
    bw = arr < THRESHOLD  # True where there is ink.

    # potrace wants a Bitmap of bools — uint8 silently collapses into a
    # single curve covering the whole image, so we must pass a bool array.
    bmp = potrace.Bitmap(bw)
    path = bmp.trace(
        turdsize=TURDSIZE,
        turnpolicy=potrace.POTRACE_TURNPOLICY_MAJORITY,
        alphamax=ALPHAMAX,
        opticurve=True,
        opttolerance=OPTTOLERANCE,
    )

    # Build one big SVG path d-string. Each curve becomes a subpath
    # (M start ... Z).
    def xy(p) -> tuple[float, float]:
        return p.x, p.y

    d_parts: list[str] = []
    for curve in path:
        d = []
        sx, sy = xy(curve.start_point)
        d.append(f"M {sx:.2f} {sy:.2f}")
        for seg in curve:
            if seg.is_corner:
                cx, cy = xy(seg.c)
                ex, ey = xy(seg.end_point)
                d.append(f"L {cx:.2f} {cy:.2f}")
                d.append(f"L {ex:.2f} {ey:.2f}")
            else:
                c1x, c1y = xy(seg.c1)
                c2x, c2y = xy(seg.c2)
                ex, ey = xy(seg.end_point)
                d.append(f"C {c1x:.2f} {c1y:.2f} {c2x:.2f} {c2y:.2f} {ex:.2f} {ey:.2f}")
        d.append("Z")
        d_parts.append(" ".join(d))
    big_d = " ".join(d_parts)

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {new_w} {new_h}" '
        f'width="{new_w}" height="{new_h}">\n'
        f'  <path d="{big_d}" '
        f'fill="{FILL_COLOR}" stroke="{STROKE_COLOR}" '
        f'stroke-width="{STROKE_WIDTH}" stroke-linejoin="round" '
        f'fill-rule="evenodd"/>\n'
        f'</svg>\n'
    )
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(svg, encoding="utf-8")
    return new_w, new_h


def main() -> int:
    if not SRC_DIR.exists():
        print(f"source dir not found: {SRC_DIR}", file=sys.stderr)
        return 1
    crops = sorted(SRC_DIR.glob("*.jpg"))
    print(f"tracing {len(crops)} crops → {OUT_DIR}")
    for crop in crops:
        out = OUT_DIR / (crop.stem + ".svg")
        try:
            w, h = trace_image(crop, out)
            print(f"  {crop.name:>20s} → {out.name:>20s}  ({w}×{h})")
        except Exception as e:  # pragma: no cover
            print(f"  {crop.name:>20s} FAILED: {e}", file=sys.stderr)
    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
