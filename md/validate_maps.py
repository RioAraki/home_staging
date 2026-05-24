"""Validate maps_data.yaml.

For each scenario:
- parse the ASCII grid
- decode cells via the legend
- compute terrain counts, zone counts, sub_zone counts, building bbox,
  pre_drawn counts, rooms, bonus_points
- compare to the declared `stats:` block; report mismatches
- check that every grid character has a legend entry
- check that every cell coordinate elsewhere in the file is in-bounds

Exit code 0 = all OK, 1 = mismatches found.
"""
from __future__ import annotations
import sys, yaml
from pathlib import Path

PATH = Path(__file__).with_name("maps_data.yaml")


def cell_in_bounds(rc):
    r, c = rc
    return 0 <= r < 16 and 0 <= c < 16


def compute_stats(sc):
    g = sc["grid"]["ascii"].rstrip("\n").split("\n")
    legend = sc["grid"]["legend"]
    counts_char = {}
    by_terrain = {}
    by_zone = {}
    by_sub_zone = {}
    indoor_cells = []
    issues = []

    for r, row in enumerate(g):
        if len(row) != 16:
            issues.append(f"row {r} has {len(row)} chars, expected 16")
        for c, ch in enumerate(row):
            counts_char[ch] = counts_char.get(ch, 0) + 1
            attr = legend.get(ch)
            if attr is None:
                issues.append(f"char {ch!r} at ({r},{c}) missing from legend")
                continue
            t = attr.get("terrain", "outdoor")
            by_terrain[t] = by_terrain.get(t, 0) + 1
            if t in ("indoor", "water", "obstacle"):
                indoor_cells.append((r, c))
            z = attr.get("zone")
            if z:
                by_zone[z] = by_zone.get(z, 0) + 1
            sz = attr.get("sub_zone")
            if sz:
                by_sub_zone[sz] = by_sub_zone.get(sz, 0) + 1

    bbox = None
    if indoor_cells:
        rs = [r for r, _ in indoor_cells]
        cs = [c for _, c in indoor_cells]
        bbox = [min(rs), min(cs), max(rs) + 1, max(cs) + 1]

    pre = sc.get("pre_drawn", {})
    pre_counts = {
        "doors": len(pre.get("doors") or []),
        "windows": len(pre.get("windows") or []),
        "walls_interior": len(pre.get("walls_interior") or []),
    }

    # In-bounds check for every cell-ref in pre_drawn
    for d in pre.get("doors") or []:
        if not cell_in_bounds(d["cell"]):
            issues.append(f"door cell {d['cell']} out of bounds")
    for w in pre.get("windows") or []:
        if not cell_in_bounds(w["cell"]):
            issues.append(f"window cell {w['cell']} out of bounds")
    for r1, c1, r2, c2 in pre.get("walls_interior") or []:
        if not (cell_in_bounds((r1, c1)) and cell_in_bounds((r2, c2))):
            issues.append(f"wall {[r1,c1,r2,c2]} out of bounds")
        if abs(r1 - r2) + abs(c1 - c2) != 1:
            issues.append(f"wall {[r1,c1,r2,c2]} not between adjacent cells")

    return {
        "cells_total": 256,
        "cells_by_terrain": by_terrain,
        "cells_by_zone": by_zone,
        "cells_by_sub_zone": by_sub_zone,
        "building_bbox": bbox,
        "pre_drawn_counts": pre_counts,
        "rooms": len(sc.get("rooms") or []),
        "bonus_points": len(sc.get("bonus_points") or []),
    }, issues


def main() -> int:
    d = yaml.safe_load(PATH.read_text(encoding="utf-8"))
    errors = 0
    for sc in d["scenarios"]:
        computed, issues = compute_stats(sc)
        declared = sc.get("stats") or {}
        print(f"== {sc['id']} ==")
        for k, v in computed.items():
            dv = declared.get(k)
            if dv is None and v in ({}, []):
                continue   # absent + empty is fine
            if dv != v:
                print(f"  MISMATCH {k}: declared={dv}  computed={v}")
                errors += 1
            else:
                print(f"  ok {k}: {v}")
        for x in issues:
            print(f"  ISSUE: {x}")
            errors += 1
        print()
    if errors:
        print(f"validation FAILED: {errors} issue(s)")
        return 1
    print("validation OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
