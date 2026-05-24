"""Overlay each scenario's parsed grid onto its source page image.

Outputs `images/scenarios/_verify_<scenario_id>.png` per scenario, with the
indoor cells from `maps_data.yaml` painted as translucent coloured squares on
top of the original floor-plan photo. Wrong placement / wrong dimensions /
wrong rotation become visible at a glance.

Per scenario, the YAML needs `grid_pixel_bbox: [top, left, bottom, right]`
that locates the 16×16 grid inside the page image (pixel coordinates of the
outer corners of cell (0,0) top-left and cell (15,15) bottom-right). If
absent, the tool tries to auto-detect.

Run:  python overlay_maps.py [--only training,airy_loft]
"""
from __future__ import annotations
import sys, argparse, yaml
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent
YAML = ROOT / "maps_data.yaml"

# Colours per zone code (RGBA, alpha 90)
ZONE_COLOURS = {
    "I": (50, 180, 255, 110),   # plain indoor → blue
    "L": (255, 180, 50, 110),   # living/dining → orange
    "B": (255, 80, 200, 130),   # bathroom → magenta
    "G": (120, 220, 80, 110),   # ground floor → green
    "U": (200, 140, 255, 110),  # upper floor → purple
    "T": (255, 220, 80, 110),   # top floor → yellow
    "X": (255, 80, 200, 130),   # bathroom sub-zone → magenta
}


def find_grid_bbox_auto(pil_img):
    """Detect the 16×16 drafting grid by finding the dense gridline pattern.

    Returns (top, left, bottom, right) pixel coords for the outer corners of
    cell (0,0) and cell (15,15). Falls back to a rough heuristic if detection
    fails.
    """
    import numpy as np
    img = np.array(pil_img.convert("RGB"))
    H, W, _ = img.shape
    R, G, B = img[..., 0], img[..., 1], img[..., 2]
    # Light cyan gridline on white paper
    gridline = (
        (R > 130) & (R < 210)
        & (G > 180) & (G < 235)
        & (B > 200) & (B < 245)
        & (B > R + 25)
    )
    # Restrict to left half of the spread
    gridline[:, W // 2 :] = False

    rs = gridline.sum(axis=1).astype(float)
    cs = gridline.sum(axis=0).astype(float)

    def smooth(arr, win=31):
        pad = win // 2
        return np.convolve(np.pad(arr, pad, mode="edge"), np.ones(win) / win, mode="valid")

    rs_s = smooth(rs)
    cs_s = smooth(cs)

    def longest_block(arr, thresh):
        mask = arr > thresh
        best = (0, 0, 0)
        cur = None
        for i, m in enumerate(mask):
            if m and cur is None:
                cur = i
            elif (not m) and cur is not None:
                L = i - cur
                if L > best[0]:
                    best = (L, cur, i)
                cur = None
        if cur is not None:
            L = len(mask) - cur
            if L > best[0]:
                best = (L, cur, len(mask))
        return best

    _, r_top, r_bot = longest_block(rs_s, rs_s.max() * 0.5)
    _, c_left, c_right = longest_block(cs_s, cs_s.max() * 0.5)

    # Sanity check: should be 16 cells of similar size in both axes
    cell_w = (c_right - c_left) / 16 if c_right > c_left else 0
    cell_h = (r_bot - r_top) / 16 if r_bot > r_top else 0
    # Expected cell size for these PDFs at 180 DPI: ~46 px
    too_small = cell_w < 35 or cell_h < 35
    too_big = cell_w > 60 or cell_h > 60
    if abs(cell_w - cell_h) > min(cell_w, cell_h) * 0.15 or too_small or too_big:
        # Detection looks wrong, fall back to empirical standard bbox
        return int(H * 0.357), int(W * 0.073), int(H * 0.937), int(W * 0.435)

    return r_top, c_left, r_bot, c_right


def overlay(scenario, out_dir):
    page = ROOT / scenario["page_image"]
    if not page.exists():
        print(f"  skip {scenario['id']}: missing {page}")
        return False
    img = Image.open(page).convert("RGBA")
    grid_bbox = scenario.get("grid_pixel_bbox") or find_grid_bbox_auto(img)
    top, left, bottom, right = grid_bbox
    cell_w = (right - left) / 16
    cell_h = (bottom - top) / 16

    overlay_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay_layer)

    # Paint each non-outdoor cell with its zone colour
    g = scenario["grid"]["ascii"].rstrip("\n").split("\n")
    legend = scenario["grid"]["legend"]
    for r, row in enumerate(g):
        for c, ch in enumerate(row):
            attr = legend.get(ch, {})
            if attr.get("terrain") == "outdoor":
                continue
            col = ZONE_COLOURS.get(ch, (255, 100, 100, 100))
            x0 = int(left + c * cell_w)
            y0 = int(top + r * cell_h)
            x1 = int(left + (c + 1) * cell_w)
            y1 = int(top + (r + 1) * cell_h)
            draw.rectangle([x0, y0, x1, y1], fill=col, outline=(0, 0, 0, 180))

    # Draw the 16×16 grid lines on top for reference
    for i in range(17):
        x = int(left + i * cell_w)
        y = int(top + i * cell_h)
        draw.line([(x, top), (x, bottom)], fill=(255, 255, 255, 80), width=1)
        draw.line([(left, y), (right, y)], fill=(255, 255, 255, 80), width=1)

    # Column letters A..P at top, row numbers 1..16 on left
    try:
        for c in range(16):
            label = chr(ord("A") + c)
            draw.text((int(left + c * cell_w + 2), top - 18), label,
                      fill=(255, 0, 0, 230))
        for r in range(16):
            draw.text((left - 22, int(top + r * cell_h + 2)), str(r + 1),
                      fill=(255, 0, 0, 230))
    except Exception:
        pass

    out = Image.alpha_composite(img, overlay_layer)
    out_path = out_dir / f"_verify_{scenario['id']}.png"
    out.convert("RGB").save(out_path)
    print(f"  wrote {out_path}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="comma-separated scenario ids")
    args = ap.parse_args()
    only = {x.strip() for x in args.only.split(",") if x.strip()}

    d = yaml.safe_load(YAML.read_text(encoding="utf-8"))
    out_dir = ROOT / "images" / "scenarios"
    ok = bad = 0
    for sc in d["scenarios"]:
        if only and sc["id"] not in only:
            continue
        print(f"== {sc['id']} ==")
        if overlay(sc, out_dir):
            ok += 1
        else:
            bad += 1
    print(f"\ndone: {ok} written, {bad} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
