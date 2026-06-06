#!/usr/bin/env python3
"""Batch-crop sprite-sheet tiles from an annotations.json exported by index.html.

Usage:
    python crop.py                         # uses ./annotations.json + ../../asset/asset.png
    python crop.py annotations.json asset.png out/

Each annotation -> one PNG named after its label (filesystem-sanitised).
Duplicate labels are reported and de-duplicated with a __2, __3 suffix so no
crop is silently lost. Crops are clamped to the image bounds.
"""
import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install pillow")

HERE = Path(__file__).resolve().parent
json_path = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "annotations.json"
img_path = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / ".." / ".." / "asset" / "asset.png"
out_dir = Path(sys.argv[3]) if len(sys.argv) > 3 else HERE / "out"

if not json_path.exists():
    sys.exit(f"annotations not found: {json_path}")
if not img_path.exists():
    sys.exit(f"image not found: {img_path}")

data = json.loads(json_path.read_text(encoding="utf-8"))
anns = data.get("annotations", [])
out_dir.mkdir(parents=True, exist_ok=True)

img = Image.open(img_path).convert("RGBA")
W, H = img.size


def sanitize(name: str) -> str:
    name = name.strip() or "unnamed"
    return re.sub(r'[\\/:*?"<>|]+', "_", name)


seen = {}
written = 0
for a in anns:
    x, y = int(a["x"]), int(a["y"])
    w, h = int(a["w"]), int(a["h"])
    x2, y2 = min(x + w, W), min(y + h, H)
    if x >= W or y >= H or x2 <= x or y2 <= y:
        print(f"skip (out of bounds): {a.get('label')} @ {x},{y}")
        continue
    base = sanitize(a.get("label", "unnamed"))
    seen[base] = seen.get(base, 0) + 1
    fname = base if seen[base] == 1 else f"{base}__{seen[base]}"
    if seen[base] == 2:
        print(f"WARNING duplicate label '{base}' -> writing {fname}.png (check for mistaken double-tap)")
    img.crop((x, y, x2, y2)).save(out_dir / f"{fname}.png")
    written += 1

print(f"\ndone: {written} tiles -> {out_dir}")
dups = [k for k, v in seen.items() if v > 1]
if dups:
    print(f"{len(dups)} duplicated label(s): {', '.join(dups)}")

# always regenerate tiles.json from the full directory contents
all_tiles = sorted([p.stem for p in out_dir.glob("*.png")])
tiles_json = out_dir / "tiles.json"
tiles_json.write_text(json.dumps(all_tiles, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"tiles.json updated: {len(all_tiles)} tiles")
