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


def make_option(furn: dict, option_index: int) -> dict:
    """Build one FurnitureOption from a collection furniture object."""
    rows, cols  = furn['bbox']
    tile_cells  = {(t['row'], t['col']) for t in furn.get('tiles', [])}
    open_cells  = {tuple(c) for c in furn.get('open_cells', [])}
    return {
        'option_index':    option_index,
        'name_zh':         furn['name'],
        'name_en':         furn['name'],
        'bbox':            [rows, cols],
        'shape':           sorted(tile_cells),
        'open_spaces':     sorted(open_cells),
        'wall_edges':      [],
        'printed_markers': 0,
    }


def make_card_entry(opt1_furn: dict, opt2_furn: dict, number: int) -> dict:
    """One card with two options — the game's 二选一 pattern."""
    return {
        'number':  number,
        'variant': 'A',
        'image':   '',
        'options': [
            make_option(opt1_furn, 1),
            make_option(opt2_furn, 2),
        ],
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
    for opt in [1, 2]:
        png = VEC_DIR / f'98_A_opt{opt}.png'
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

    print(f'Demo furniture (card #98, opt1 vs opt2):')
    for i, f in enumerate(chosen):
        print(f'  opt{i+1}: {f["name"]}  bbox={f["bbox"]}')

    # render PNGs — both options of card 98
    CARD_NUM = 98
    VEC_DIR.mkdir(parents=True, exist_ok=True)
    for i, furn in enumerate(chosen):
        img = render_furniture(furn)
        out = VEC_DIR / f'{CARD_NUM:02d}_A_opt{i+1}.png'
        img.save(out)
        print(f'  rendered → {out.name}  ({img.width}×{img.height})')

    # patch furniture_data.json — one card with two options
    backup(FURN_JSON)
    fdata = load_json(FURN_JSON)
    fdata['cards'] = [c for c in fdata['cards'] if c['number'] != CARD_NUM]
    fdata['cards'].append(make_card_entry(chosen[0], chosen[1], CARD_NUM))
    save_json(FURN_JSON, fdata)
    print(f'  patched furniture_data.json (card #{CARD_NUM} with 2 options)')

    # patch maps_data.json — first room of training scenario uses only card 98
    backup(MAPS_JSON)
    mdata = load_json(MAPS_JSON)
    training = next((s for s in mdata['scenarios'] if s['id'] == 'training'), None)
    if not training:
        print('WARNING: training scenario not found in maps_data.json')
    else:
        if training['rooms']:
            training['rooms'][0]['furniture_numbers'] = [CARD_NUM]
            save_json(MAPS_JSON, mdata)
            room_name = training['rooms'][0].get('name_zh', training['rooms'][0]['slot'])
            print(f'  patched maps_data.json — room "{room_name}" → [98]')

    print('\ndone — refresh Cocos preview (重新打开 scene.scene) to see demo art')
    print('revert anytime:  python tools/demo_patch.py --revert')


main()
