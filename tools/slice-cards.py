#!/usr/bin/env python3
"""EXPERIMENTAL: slice furniture card photos into 100x100 per-cell tiles.

Each card (md/images/cards/furniture/NN_[AB].jpg) holds two option diagrams
(grids of cells) stacked vertically. Given the known bbox (rows x cols) of each
option from furniture_data.json, this tries to:
  1. find the central divider that separates the two option diagrams,
  2. for each half, find the grid rectangle via strong horizontal/vertical lines,
  3. slice that rectangle into bbox cells and export each SHAPE cell at 100x100.

This is a best-effort heuristic on hand-drawn diagrams; inspect the debug output.
Usage: python tools/slice-cards.py <number> <variant>   e.g. 1 A
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'cocos', 'home-staging-cocos', 'assets', 'resources', 'data', 'furniture_data.json')
DEBUG = os.path.join(ROOT, 'tools', '_slice_debug')

num = int(sys.argv[1]) if len(sys.argv) > 1 else 1
var = sys.argv[2] if len(sys.argv) > 2 else 'A'

cards = json.load(open(DATA, encoding='utf-8'))['cards']
card = next(c for c in cards if c['number'] == num and c['variant'] == var)
img_path = os.path.join(ROOT, 'md', card['image'])
os.makedirs(DEBUG, exist_ok=True)

im = Image.open(img_path).convert('L')
arr = np.asarray(im)
H, W = arr.shape
dark = arr < 110  # ink mask

# 1. divider: widest dark row in the middle band
band = range(int(H * 0.38), int(H * 0.62))
row_dark = dark.sum(axis=1)
divider = max(band, key=lambda r: row_dark[r])
print(f'card {num}{var} size={W}x{H} divider_row={divider} ({divider/H:.2f})')


def grid_rect(y0, y1):
    """Bounding box of strong grid lines within rows [y0,y1)."""
    sub = dark[y0:y1, :]
    hh = y1 - y0
    col_frac = sub.sum(axis=0) / hh
    row_frac = sub.sum(axis=1) / W
    cols = np.where(col_frac > 0.25)[0]
    rows = np.where(row_frac > 0.25)[0]
    if len(cols) == 0 or len(rows) == 0:
        return None
    return int(cols[0]), int(y0 + rows[0]), int(cols[-1]) + 1, int(y0 + rows[-1]) + 1


def slice_option(opt, y0, y1, label):
    rect = grid_rect(y0, y1)
    rows, cols = opt['bbox']
    info = {'option': label, 'bbox': opt['bbox'], 'rect': rect}
    if not rect:
        print(f'  {label}: NO GRID FOUND'); return info
    x0, ry0, x1, ry1 = rect
    cw, ch = (x1 - x0) / cols, (ry1 - ry0) / rows
    info['cell_px'] = (round(cw, 1), round(ch, 1))
    # debug crop of the detected grid rectangle
    im.crop((x0, ry0, x1, ry1)).save(os.path.join(DEBUG, f'{num}{var}_{label}_rect.png'))
    shape = {tuple(c) for c in opt['shape']}
    full = Image.open(img_path).convert('RGB')
    for (r, c) in sorted(shape):
        cx0 = int(x0 + c * cw); cy0 = int(ry0 + r * ch)
        cx1 = int(x0 + (c + 1) * cw); cy1 = int(ry0 + (r + 1) * ch)
        tile = full.crop((cx0, cy0, cx1, cy1)).resize((100, 100))
        tile.save(os.path.join(DEBUG, f'{num}{var}_{label}_r{r}c{c}.png'))
    print(f'  {label}: rect={rect} cell={info["cell_px"]} shape_cells={len(shape)}')
    return info


slice_option(card['options'][0], 0, divider, 'opt1')
slice_option(card['options'][1], divider, H, 'opt2')
print(f'debug images -> {DEBUG}')
