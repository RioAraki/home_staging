"""Auto-detect a scenario's indoor/outdoor grid from its page image.

Algorithm:
1. Locate the 16x16 grid bbox in the page image (reuse find_grid_bbox_auto).
2. Inside the grid, find dark pen pixels (the hand-drawn building outline).
3. Flood-fill from the OUTSIDE of the bbox — cells reachable by the flood
   without crossing pen pixels are "outdoor"; the rest are "indoor".
4. Aggregate per-cell: a cell is "indoor" if a majority of its pixels are
   not reachable by the flood.

Usage:
    python auto_detect_grid.py <scenario_id>
e.g. python auto_detect_grid.py alpine_wellness_hut
"""
from __future__ import annotations
import sys, yaml
from pathlib import Path
import numpy as np
from PIL import Image

from overlay_maps import find_grid_bbox_auto

ROOT = Path(__file__).parent
YAML = ROOT / "maps_data.yaml"


def detect_indoor_grid(page_path: Path) -> tuple[list[str], dict]:
    """Return (16-row ASCII grid, debug info)."""
    img = Image.open(page_path)
    top, left, bottom, right = find_grid_bbox_auto(img)
    arr = np.array(img.convert("RGB"))

    # Crop just the grid region
    grid_pixels = arr[top:bottom, left:right]
    H, W, _ = grid_pixels.shape
    cell_h = H / 16
    cell_w = W / 16

    # Find pen + marker pixels (the building outline + colored door/zone marks)
    R, G, B = grid_pixels[..., 0], grid_pixels[..., 1], grid_pixels[..., 2]
    # Dark navy pen (the proven filter that worked across most scenarios)
    dark_pen = ((R < 100) & (G < 100) & (B < 180)) | ((R < 80) & (G < 80) & (B < 100))
    # Saturated green door markers (#13 wagon corner doors, #24 balcony railing)
    green_marker = (G > 140) & (G > R + 40) & (G > B + 20) & (R < 200)
    # Saturated yellow markers (#24 low-ceiling cells, #19 carpet preset)
    yellow_marker = (R > 200) & (G > 170) & (G < 235) & (B < 130)

    pen = dark_pen | green_marker | yellow_marker

    from scipy.ndimage import binary_dilation, binary_closing
    pen = binary_closing(pen, iterations=3)
    pen = binary_dilation(pen, iterations=2)

    # Flood-fill from outside (a known outdoor pixel — top-left corner)
    from scipy.ndimage import label
    walkable = ~pen
    # Start flood from corner (assumed outdoor)
    seed = np.zeros_like(walkable)
    # Use multiple corner seeds in case one happens to land on a pen pixel
    for r, c in [(0, 0), (0, W - 1), (H - 1, 0), (H - 1, W - 1)]:
        if walkable[r, c]:
            seed[r, c] = True
    # Label connected components in walkable; outdoor = same component as seeds
    labels, _ = label(walkable)
    if not seed.any():
        # fallback
        return ["." * 16] * 16, {"error": "no outdoor seed"}
    outdoor_labels = set(labels[seed].tolist())
    outdoor_mask = np.isin(labels, list(outdoor_labels))
    indoor_pixel_mask = walkable & ~outdoor_mask

    # Per-cell majority vote: if > 50% of pixels in the cell are "indoor", mark I
    rows = []
    for r in range(16):
        row = []
        for c in range(16):
            y0 = int(r * cell_h); y1 = int((r + 1) * cell_h)
            x0 = int(c * cell_w); x1 = int((c + 1) * cell_w)
            cell = indoor_pixel_mask[y0:y1, x0:x1]
            if cell.size == 0:
                row.append(".")
                continue
            frac = cell.mean()
            row.append("I" if frac > 0.30 else ".")
        rows.append("".join(row))

    info = {
        "grid_bbox": (top, left, bottom, right),
        "cell_size": (cell_h, cell_w),
        "pen_pixel_count": int(pen.sum()),
        "indoor_cells": sum(row.count("I") for row in rows),
    }
    return rows, info


def main() -> int:
    sid = sys.argv[1] if len(sys.argv) > 1 else "alpine_wellness_hut"
    doc = yaml.safe_load(YAML.read_text(encoding="utf-8"))
    sc = next((s for s in doc["scenarios"] if s["id"] == sid), None)
    if not sc:
        print(f"unknown scenario: {sid}")
        return 1
    page = ROOT / sc["page_image"]
    rows, info = detect_indoor_grid(page)
    print(f"== {sid} ==")
    print(f"info: {info}")
    print("detected grid:")
    for r, row in enumerate(rows):
        print(f"  {r:2d}: {row}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
