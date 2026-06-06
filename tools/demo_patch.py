#!/usr/bin/env python3
"""
Render 2 random furniture from furniture_collection.json and patch the Cocos
training scenario so they appear in the game as demo pieces (IDs 98 & 99).

Usage:
    python tools/demo_patch.py                    # random 2
    python tools/demo_patch.py "长沙发" "蓝色玫瑰"  # pick by name

Revert:
    python tools/demo_patch.py --revert
"""

import json, sys, shutil, random
from pathlib import Path
from PIL import Image

ROOT       = Path(__file__).resolve().parent.parent
COLL_JSON  = ROOT / 'asset' / 'furniture_collection.json'
TILES_DIR  = ROOT / 'asset' / 'tiles'
COCOS_RES  = ROOT / 'cocos/home-staging-cocos/assets/resources'
VEC_DIR    = COCOS_RES / 'cards' / 'vector'
FURN_JSON  = COCOS_RES / 'data' / 'furniture_data.json'
MAPS_JSON  = COCOS_RES / 'data' / 'maps_data.json'
DEMO_IDS   = [98, 99]
BACKUP_EXT = '.demo_backup'


# ── helpers ────────────────────────────────────────────────────────────────

def load_json(p: Path):
    return json.loads(p.read_text(encoding='utf-8'))

def save_json(p: Path, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def backup(p: Path):
    bak = p.with_suffix(p.suffix + BACKUP_EXT)
    if not bak.exists():
        shutil.copy2(p, bak)
        print(f'  backed up → {bak.name}')


def render_furniture(furn: dict) -> Image.Image:
    """Composite tile PNGs into a single RGBA image matching the furniture bbox."""
    rows, cols = furn['bbox']
    canvas = Image.new('RGBA', (cols * 100, rows * 100), (0, 0, 0, 0))

    for t in furn.get('tiles', []):
        tile_path = TILES_DIR / f"{t['tile']}.png"
        if not tile_path.exists():
            print(f'  WARNING: tile not found: {tile_path.name}')
            continue
        img = Image.open(tile_path).convert('RGBA')

        # canvas rotates CW; PIL.rotate() is CCW → negate
        rot = t.get('rotation', 0)
        if rot:
            # use ROTATE_* for lossless 90° steps
            cw_to_pil = {90: Image.Transpose.ROTATE_270,
                         180: Image.Transpose.ROTATE_180,
                         270: Image.Transpose.ROTATE_90}
            img = img.transpose(cw_to_pil[rot])

        if t.get('mirror'):
            img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

        canvas.paste(img, (t['col'] * 100, t['row'] * 100), img)

    return canvas


def make_furniture_entry(furn: dict, number: int) -> dict:
    """Build a FurnitureCard JSON entry from a collection furniture object."""
    rows, cols = furn['bbox']
    tile_cells  = {(t['row'], t['col']) for t in furn.get('tiles', [])}
    open_cells  = {tuple(c) for c in furn.get('open_cells', [])}  # [row,col]
    # shape = cells that have a tile (may overlap with open_cells for rugs etc.)
    shape       = sorted(tile_cells)
    open_spaces = sorted(open_cells)

    return {
        'number':  number,
        'variant': 'A',
        'image':   '',
        'options': [{
            'option_index':   1,
            'name_zh':        furn['name'],
            'name_en':        furn['name'],
            'bbox':           [rows, cols],
            'shape':          shape,
            'open_spaces':    open_spaces,
            'wall_edges':     [],
            'printed_markers': 0,
        }],
    }


# ── revert ─────────────────────────────────────────────────────────────────

def revert():
    restored = 0
    for p in [FURN_JSON, MAPS_JSON]:
        bak = p.with_suffix(p.suffix + BACKUP_EXT)
        if bak.exists():
            shutil.copy2(bak, p)
            bak.unlink()
            print(f'  restored {p.name}')
            restored += 1
    for did in DEMO_IDS:
        png = VEC_DIR / f'{did:02d}_A_opt1.png'
        if png.exists():
            png.unlink()
            print(f'  removed {png.name}')
    if restored == 0:
        print('nothing to revert (no backups found)')
    else:
        print('revert done — restart Cocos preview to see original art')


# ── main ───────────────────────────────────────────────────────────────────

def main():
    if '--revert' in sys.argv:
        revert(); return

    collection = load_json(COLL_JSON)['furniture']
    if not collection:
        print('furniture_collection.json is empty'); return

    # pick 2
    names = sys.argv[1:]
    if names:
        chosen = []
        for name in names:
            f = next((x for x in collection if x['name'] == name), None)
            if not f:
                available = [x['name'] for x in collection]
                print(f'ERROR: "{name}" not found. Available:\n  ' + '\n  '.join(available))
                return
            chosen.append(f)
    else:
        chosen = random.sample(collection, min(2, len(collection)))

    print(f'Demo furniture:')
    for i, f in enumerate(chosen):
        print(f'  [{DEMO_IDS[i]:02d}] {f["name"]}  bbox={f["bbox"]}')

    # render PNGs
    VEC_DIR.mkdir(parents=True, exist_ok=True)
    for furn, did in zip(chosen, DEMO_IDS):
        img = render_furniture(furn)
        out = VEC_DIR / f'{did:02d}_A_opt1.png'
        img.save(out)
        print(f'  rendered → {out.name}  ({img.width}×{img.height})')

    # patch furniture_data.json
    backup(FURN_JSON)
    fdata = load_json(FURN_JSON)
    # remove any existing demo entries then add fresh
    fdata['cards'] = [c for c in fdata['cards'] if c['number'] not in DEMO_IDS]
    for furn, did in zip(chosen, DEMO_IDS):
        fdata['cards'].append(make_furniture_entry(furn, did))
    save_json(FURN_JSON, fdata)
    print(f'  patched furniture_data.json (+{len(chosen)} entries)')

    # patch maps_data.json — first room of training scenario
    backup(MAPS_JSON)
    mdata = load_json(MAPS_JSON)
    training = next((s for s in mdata['scenarios'] if s['id'] == 'training'), None)
    if not training:
        print('WARNING: training scenario not found in maps_data.json')
    else:
        if training['rooms']:
            training['rooms'][0]['furniture_numbers'] = DEMO_IDS[:len(chosen)]
            save_json(MAPS_JSON, mdata)
            room_name = training['rooms'][0].get('name_zh', training['rooms'][0]['slot'])
            print(f'  patched maps_data.json — room "{room_name}" → {DEMO_IDS[:len(chosen)]}')

    print('\ndone — refresh Cocos preview (重新打开 scene.scene) to see demo art')
    print('revert anytime:  python tools/demo_patch.py --revert')


main()
