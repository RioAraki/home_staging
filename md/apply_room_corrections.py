"""One-shot script to apply user-confirmed room corrections to maps_data.yaml.

Two kinds of edits:
1. furniture_numbers list updated (with duplicates) per (scenario_id, room_slot)
2. name_zh translation fix per (scenario_id, room_slot)

We do surgical text replacement so section-header comments stay intact.
"""
from __future__ import annotations
from pathlib import Path
import re

DATA = Path(__file__).parent / 'maps_data.yaml'

# (scenario_id, room_slot) → new furniture list
FURNITURE_FIXES: dict[tuple[str, str], list[int]] = {
    ('training', 'I'):                       [2, 15, 19, 19],
    # training II, III unchanged
    ('alpine_wellness_hut', 'I'):            [4, 7, 20, 20],
    ('alpine_wellness_hut', 'II'):           [12, 13, 13, 13],
    ('alpine_wellness_hut', 'III'):          [8, 9, 10, 11, 11, 18, 18, 18, 21, 21, 31],
    ('mountain_surgery', 'I'):               [3, 3, 16, 18, 21, 21, 24, 31, 32, 32, 32],
    ('mountain_surgery', 'II'):              [1, 1, 19, 19],
    ('mountain_surgery', 'III'):             [3, 3, 17],
    ('castle_cafe', 'I'):                    [3, 3, 7, 7],
    ('castle_cafe', 'II'):                   [8, 8, 9],
    ('castle_cafe', 'III'):                  [4, 4, 5, 5, 5, 5, 5, 5, 19, 19, 30],
    ('rehearsal_room_old_barn', 'I'):        [7, 15, 17, 20, 21, 27, 27, 28, 29, 33],
    ('game_store_old_town', 'I'):            [3, 3, 3, 3, 3, 4, 5, 5, 15, 15, 15, 15, 20, 20, 23, 30, 33],
}

# (scenario_id, room_slot) → new name_zh
NAME_FIXES: dict[tuple[str, str], str] = {
    ('alpine_wellness_hut', 'III'): '疗养区',
    ('game_store_old_town', 'I'): '桌游店',
}


def main() -> None:
    lines = DATA.read_text(encoding='utf-8').splitlines()
    out: list[str] = []

    cur_id: str | None = None
    cur_slot: str | None = None
    applied_furn: set[tuple[str, str]] = set()
    applied_name: set[tuple[str, str]] = set()

    i = 0
    while i < len(lines):
        line = lines[i]

        m = re.match(r'^- id: (.+)$', line)
        if m:
            cur_id = m.group(1).strip()
            cur_slot = None

        m = re.match(r'^  - slot: ([A-Z]+)$', line)
        if m:
            cur_slot = m.group(1)

        # Translation fix: replace name_zh line
        if cur_id and cur_slot and re.match(r'^    name_zh: ', line):
            key = (cur_id, cur_slot)
            if key in NAME_FIXES:
                indent = '    '
                out.append(f'{indent}name_zh: {NAME_FIXES[key]}')
                applied_name.add(key)
                i += 1
                continue

        # furniture_numbers list: replace the `furniture_numbers:` line + all
        # following `    - N` block-list items
        if cur_id and cur_slot and line.rstrip() == '    furniture_numbers:':
            key = (cur_id, cur_slot)
            if key in FURNITURE_FIXES:
                out.append('    furniture_numbers:')
                for n in FURNITURE_FIXES[key]:
                    out.append(f'    - {n}')
                applied_furn.add(key)
                # Skip the original list items (lines starting with `    - <digit>`)
                j = i + 1
                while j < len(lines) and re.match(r'^    - \d+$', lines[j]):
                    j += 1
                i = j
                continue

        out.append(line)
        i += 1

    DATA.write_text('\n'.join(out) + '\n', encoding='utf-8')

    print(f'Applied furniture fixes: {len(applied_furn)} / {len(FURNITURE_FIXES)}')
    missing_furn = set(FURNITURE_FIXES.keys()) - applied_furn
    for k in sorted(missing_furn):
        print(f'  MISSING: {k}')
    print(f'Applied name fixes:      {len(applied_name)} / {len(NAME_FIXES)}')
    missing_name = set(NAME_FIXES.keys()) - applied_name
    for k in sorted(missing_name):
        print(f'  MISSING: {k}')


if __name__ == '__main__':
    main()
