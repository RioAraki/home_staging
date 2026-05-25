"""Apply structured proposed edits from `review_comments.json` to
`furniture_data.yaml`.

The visual cell editor in the review UI saves one record per
(cardKey, optionIndex) in the form:
    { bbox, shape, open_spaces }
We surgically replace just those 3 lines in the yaml per matched option, so
inline comments / section headers / wall_edges / notes / printed_markers stay
intact.
"""
from __future__ import annotations
from pathlib import Path
import json
import re

ROOT = Path(__file__).parent
DATA = ROOT / 'furniture_data.yaml'
COMMENTS = ROOT / 'review_comments.json'


def fmt_bbox(b: list[int]) -> str:
    return f'[{b[0]}, {b[1]}]'


def fmt_cells(cells: list[list[int]]) -> str:
    if not cells:
        return '[]'
    return '[' + ','.join(f'[{c[0]},{c[1]}]' for c in cells) + ']'


def fmt_wall_edges(edges: list[str]) -> str:
    if not edges:
        return '[]'
    return '[' + ', '.join(edges) + ']'


def main() -> None:
    review = json.loads(COMMENTS.read_text(encoding='utf-8'))
    edits = review.get('edits', [])
    # Lookup: (num, variant, opt_idx) -> edit
    edit_by_key: dict[tuple[int, str, int], dict] = {}
    for e in edits:
        num_str, variant = e['cardKey'].split('-')
        edit_by_key[(int(num_str), variant, e['optionIndex'])] = e

    lines = DATA.read_text(encoding='utf-8').splitlines()
    out: list[str] = []

    cur_num: int | None = None
    cur_variant: str | None = None
    cur_opt: int | None = None
    applied: set[tuple[int, str, int]] = set()
    warnings: list[str] = []

    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r'^  - number: (\d+)$', line)
        if m:
            cur_num = int(m.group(1))
            cur_variant = None
            cur_opt = None
        m = re.match(r'^    variant: ([AB])$', line)
        if m:
            cur_variant = m.group(1)
            cur_opt = None
        m = re.match(r'^      - option_index: (\d+)$', line)
        if m:
            cur_opt = int(m.group(1))

        # Look for bbox line of the current option
        if (
            re.match(r'^        bbox:', line)
            and cur_num is not None
            and cur_variant is not None
            and cur_opt is not None
        ):
            key = (cur_num, cur_variant, cur_opt)
            if key in edit_by_key:
                # Next two lines should be `shape:` and `open_spaces:`; optionally
                # the line after that is `wall_edges:` which we patch if the edit
                # includes a wall_edges field.
                if (
                    i + 2 < len(lines)
                    and re.match(r'^        shape:', lines[i + 1])
                    and re.match(r'^        open_spaces:', lines[i + 2])
                ):
                    e = edit_by_key[key]
                    out.append(f'        bbox: {fmt_bbox(e["bbox"])}')
                    out.append(f'        shape: {fmt_cells(e["shape"])}')
                    out.append(f'        open_spaces: {fmt_cells(e["open_spaces"])}')
                    consumed = 3
                    if (
                        'wall_edges' in e
                        and i + 3 < len(lines)
                        and re.match(r'^        wall_edges:', lines[i + 3])
                    ):
                        out.append(
                            f'        wall_edges: {fmt_wall_edges(e["wall_edges"])}'
                        )
                        consumed = 4
                    applied.add(key)
                    i += consumed
                    continue
                else:
                    warnings.append(
                        f'#{cur_num}-{cur_variant} opt{cur_opt}: bbox found but'
                        ' next 2 lines are not shape/open_spaces — left untouched'
                    )

        out.append(line)
        i += 1

    DATA.write_text('\n'.join(out) + '\n', encoding='utf-8')

    print(f'Applied {len(applied)} of {len(edit_by_key)} edits.')
    unapplied = set(edit_by_key.keys()) - applied
    if unapplied:
        print('\nUnapplied edits (option not found in yaml):')
        for k in sorted(unapplied):
            print(f'  #{k[0]}-{k[1]} opt{k[2]}')
    if warnings:
        print('\nWarnings:')
        for w in warnings:
            print(f'  {w}')


if __name__ == '__main__':
    main()
