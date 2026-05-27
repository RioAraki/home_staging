"""Auto-trace each card option's SHAPE cells into per-cell SVGs.

The renderer composes a furniture piece by stamping the cell-level SVG
at each shape position. Void cells render nothing; open cells get the
existing dot indicator from the FloorPlan / FurnitureShape layer.

Output layout:
    app/public/cards/vectors/NN_X_optK_cell_R_C.svg

Each per-cell SVG uses viewBox="0 0 100 100" so they're trivially
stampable inside a cell-sized box.

Run from repo root:
    python md/trace_cards.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import potrace
import yaml
from PIL import Image

# ── Tunables ────────────────────────────────────────────────────────
THRESHOLD = 128         # 0–255; pixels darker than this become "ink".
TURDSIZE = 2            # Drop tiny noise speckles smaller than N pixels.
ALPHAMAX = 1.0
OPTTOLERANCE = 0.2
CELL_PX = 100           # Each cell is normalised to this many pixels
                        # before tracing (= viewBox side of the output).
BORDER_TRIM_PX = 4      # Set the outermost N pixels of every cell to
                        # white before tracing — kills the scanned card
                        # border artefacts so per-cell traces are clean.

STROKE_COLOR = "rgba(255,255,255,0.92)"
STROKE_WIDTH = 1.2
FILL_COLOR = "none"

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "app" / "public" / "cards" / "options"
OUT_DIR = ROOT / "app" / "public" / "cards" / "vectors"
DATA_YAML = ROOT / "md" / "furniture_data.yaml"


def load_card_meta() -> dict[tuple[int, str, int], dict]:
    """Map (number, variant, option_index) → option metadata (bbox/shape)."""
    with DATA_YAML.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    out: dict[tuple[int, str, int], dict] = {}
    for card in data.get("cards", []):
        for opt in card.get("options", []):
            key = (card["number"], card["variant"], opt["option_index"])
            out[key] = {
                "bbox": opt["bbox"],
                "shape": opt.get("shape", []),
                "open_spaces": opt.get("open_spaces", []),
            }
    return out


def trace_cell(arr: np.ndarray) -> str | None:
    """Trace one 100×100 grayscale array. Returns SVG d-string or None
    when the cell holds nothing worth tracing."""
    # Zero out the outermost border so scanned card frames don't leak.
    if BORDER_TRIM_PX > 0:
        b = BORDER_TRIM_PX
        arr = arr.copy()
        arr[:b, :] = 255
        arr[-b:, :] = 255
        arr[:, :b] = 255
        arr[:, -b:] = 255

    bw = arr < THRESHOLD
    if not bw.any():
        return None

    bmp = potrace.Bitmap(bw)
    path = bmp.trace(
        turdsize=TURDSIZE,
        turnpolicy=potrace.POTRACE_TURNPOLICY_MAJORITY,
        alphamax=ALPHAMAX,
        opticurve=True,
        opttolerance=OPTTOLERANCE,
    )

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
                d.append(
                    f"C {c1x:.2f} {c1y:.2f} {c2x:.2f} {c2y:.2f} {ex:.2f} {ey:.2f}",
                )
        d.append("Z")
        d_parts.append(" ".join(d))
    return " ".join(d_parts)


def trace_option(crop_path: Path, meta: dict, dest_dir: Path) -> int:
    """Slice an option crop into rows × cols cells, trace each shape cell,
    write its SVG. Returns the number of SVGs written."""
    rows, cols = meta["bbox"]
    shape: list[list[int]] = meta["shape"]
    img = Image.open(crop_path).convert("L")
    # Resize so each cell = CELL_PX × CELL_PX (regardless of source aspect).
    img = img.resize((cols * CELL_PX, rows * CELL_PX), Image.LANCZOS)
    arr_full = np.asarray(img)
    stem = crop_path.stem
    written = 0
    for r, c in shape:
        x0 = c * CELL_PX
        y0 = r * CELL_PX
        cell = arr_full[y0 : y0 + CELL_PX, x0 : x0 + CELL_PX]
        d = trace_cell(cell)
        if not d:
            continue
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {CELL_PX} {CELL_PX}" '
            f'width="{CELL_PX}" height="{CELL_PX}">\n'
            f'  <path d="{d}" '
            f'fill="{FILL_COLOR}" stroke="{STROKE_COLOR}" '
            f'stroke-width="{STROKE_WIDTH}" stroke-linejoin="round" '
            f'fill-rule="evenodd"/>\n'
            f'</svg>\n'
        )
        out = dest_dir / f"{stem}_cell_{r}_{c}.svg"
        out.write_text(svg, encoding="utf-8")
        written += 1
    return written


def main() -> int:
    if not SRC_DIR.exists():
        print(f"source dir not found: {SRC_DIR}", file=sys.stderr)
        return 1
    cards = load_card_meta()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Wipe any prior whole-card SVGs so we don't ship stale data.
    for old in OUT_DIR.glob("*.svg"):
        old.unlink()
    crops = sorted(SRC_DIR.glob("*.jpg"))
    print(f"tracing {len(crops)} option crops → {OUT_DIR} (per shape cell)")
    total_cells = 0
    for crop in crops:
        stem = crop.stem
        try:
            num_part, variant, opt_part = stem.split("_")
            number = int(num_part)
            opt = int(opt_part.replace("opt", ""))
        except (ValueError, IndexError):
            print(f"  skip (bad name): {crop.name}", file=sys.stderr)
            continue
        meta = cards.get((number, variant, opt))
        if meta is None:
            print(f"  skip (no metadata): {crop.name}", file=sys.stderr)
            continue
        n = trace_option(crop, meta, OUT_DIR)
        total_cells += n
        print(f"  {crop.name}: {n} cell svg(s)")
    print(f"done. {total_cells} per-cell svgs across {len(crops)} crops.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
