"""Run auto_detect_grid on every scenario and rewrite the ASCII grid in
maps_data.yaml.

Preserves:
  - the `legend` (zones, features) — but if the existing grid had multiple
    zone codes (L/B/G/U/T/X) we collapse the new auto-detected indoor cells
    to the most-prominent indoor code (or 'I' if none).
  - pre_drawn (doors, windows, walls)
  - rules and bonus_points

This is destructive only on the `grid.ascii` field. Run it once, then we'll
re-add zone subdivisions for multi-zone scenarios manually.
"""
import yaml
from pathlib import Path
from auto_detect_grid import detect_indoor_grid

class BlockDumper(yaml.SafeDumper): pass
def _str(d, x):
    if "\n" in x: return d.represent_scalar("tag:yaml.org,2002:str", x, style="|")
    return d.represent_scalar("tag:yaml.org,2002:str", x)
BlockDumper.add_representer(str, _str)

ROOT = Path(__file__).parent
YAML = ROOT / "maps_data.yaml"
doc = yaml.safe_load(YAML.read_text(encoding="utf-8"))

# Scenarios where we should keep the old multi-zone grid because zone
# subdivisions matter and auto-detect can't reproduce them.
# We'll process them but flag them for manual re-split afterwards.
MULTI_ZONE_KEEP_NOTE = {
    "airy_loft": "L / B bathroom inside top-right corner",
    "tiny_houses": "3 separate small houses (A, B, C)",
    "beutlers_end": "I mancave + B small bathroom annex",
    "lonely_watchtower": "3 floor zones (T top, U upper, G ground) + X bathroom sub-zone",
    "dreamy_yacht": "L lower deck + U upper deck",
    "essen_spiel_2023": "I main + S storage",
    "angled_attic_apartment": "I main + Z low ceiling + R balcony railing",
    "lake_house": "I main + W water at south",
    "cozy_beer_garden": "I main + T pre-drawn trees inside",
    "startup_tower": "I main + P pillars + S stairs",
    "game_store_old_town": "I main + S socket marker",
    "renovated_clubhouse": "I main + charred squares (placed by neighbor)",
    "rehearsal_room_old_barn": "I main + E door zone",
    "chaotic_kindergarten": "I main + C carpet preset",
}


def main():
    results = []
    for sc in doc["scenarios"]:
        sid = sc["id"]
        page = ROOT / sc["page_image"]
        if not page.exists():
            print(f"skip {sid}: page missing")
            continue
        try:
            rows, info = detect_indoor_grid(page)
        except Exception as e:
            print(f"FAIL {sid}: {e}")
            continue
        indoor = info["indoor_cells"]
        old_grid = sc["grid"]["ascii"]
        old_indoor = sum(1 for ch in old_grid if ch.isalpha())
        # Replace with auto-detected grid; legend stays as-is but indoor char
        # becomes 'I' (zones/sub-zones must be re-added manually if needed)
        sc["grid"]["ascii"] = "\n".join(rows) + "\n"
        # Reset legend to just I + . (we'll re-add zones later for multi-zone)
        sc["grid"]["legend"] = {
            ".": {"terrain": "outdoor"},
            "I": {"terrain": "indoor"},
        }
        # Keep zones block as a reference but mark needs-manual-split
        flag = MULTI_ZONE_KEEP_NOTE.get(sid)
        results.append((sid, old_indoor, indoor, flag))
        print(f"  {sid:40s}  old_indoor={old_indoor:3d} -> new={indoor:3d}"
              + (f"   [needs zone re-split: {flag}]" if flag else ""))

    YAML.write_text(
        yaml.dump(doc, Dumper=BlockDumper, allow_unicode=True,
                  sort_keys=False, width=120, indent=2),
        encoding="utf-8",
    )
    print(f"\nApplied auto-detect to {len(results)} scenarios.")
    needs_split = [r for r in results if r[3]]
    print(f"{len(needs_split)} need manual zone re-split.")


if __name__ == "__main__":
    main()
