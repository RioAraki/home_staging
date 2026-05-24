"""One-shot helper: read maps_data.yaml, recompute each scenario's stats
block from the grid + pre_drawn data, write it back inline.

Run after editing the ASCII grid of any scenario so stats stay in sync.
"""
from __future__ import annotations
import re, sys
from pathlib import Path

ROOT = Path(__file__).parent
PATH = ROOT / "maps_data.yaml"

import yaml
from validate_maps import compute_stats   # reuse the same logic

doc = yaml.safe_load(PATH.read_text(encoding="utf-8"))
for sc in doc["scenarios"]:
    computed, _ = compute_stats(sc)
    # Keep `rooms` and `bonus_points` from the YAML; everything else from computed.
    sc["stats"] = {
        "cells_total": computed["cells_total"],
        "cells_by_terrain": computed["cells_by_terrain"],
        "cells_by_zone": computed["cells_by_zone"],
        **({"cells_by_sub_zone": computed["cells_by_sub_zone"]}
           if computed["cells_by_sub_zone"] else {}),
        "building_bbox": computed["building_bbox"],
        "pre_drawn_counts": computed["pre_drawn_counts"],
        "rooms": computed["rooms"],
        "bonus_points": computed["bonus_points"],
    }

# Preserve "|" block style for multi-line strings (ASCII grids, long rule text)
class _BlockDumper(yaml.SafeDumper):
    pass

def _str_representer(dumper, data):
    if "\n" in data:
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)

_BlockDumper.add_representer(str, _str_representer)

out = yaml.dump(
    doc, Dumper=_BlockDumper, allow_unicode=True, sort_keys=False, width=120, indent=2
)
PATH.write_text(out, encoding="utf-8")
print(f"Rewrote stats for {len(doc['scenarios'])} scenarios.")
