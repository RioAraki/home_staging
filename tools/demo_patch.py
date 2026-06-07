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

import json, sys, shutil, random, uuid as _uuid
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


# ── sprite meta (trimType=none) ───────────────────────────────────────────

def write_sprite_meta(png_path: Path):
    """Write / update the Cocos .meta file so trimType=none (no stretch distortion)."""
    meta_path = Path(str(png_path) + '.meta')
    W, H = Image.open(png_path).size
    hw, hh = W / 2, H / 2

    if meta_path.exists():
        d = json.loads(meta_path.read_text(encoding='utf-8'))
        uid = d.get('uuid', str(_uuid.uuid4()).replace('-', '')[:32])
    else:
        uid = str(_uuid.uuid4()).replace('-', '')[:32]
        d = {
            'ver': '1.0.27', 'importer': 'image', 'imported': True,
            'uuid': uid, 'files': ['.json', '.png'],
            'userData': {'type': 'sprite-frame', 'fixAlphaTransparencyArtifacts': False,
                         'hasAlpha': True, 'redirect': f'{uid}@6c48a'},
            'subMetas': {},
        }

    tex_uuid = f'{uid}@6c48a'
    sf_uuid  = f'{uid}@f9941'

    d['subMetas']['6c48a'] = {
        'importer': 'texture', 'uuid': tex_uuid,
        'displayName': png_path.stem, 'id': '6c48a', 'name': 'texture',
        'userData': {
            'wrapModeS': 'clamp-to-edge', 'wrapModeT': 'clamp-to-edge',
            'imageUuidOrDatabaseUri': uid, 'isUuid': True, 'visible': False,
            'minfilter': 'linear', 'magfilter': 'linear', 'mipfilter': 'none', 'anisotropy': 0,
        },
        'ver': '1.0.22', 'imported': True, 'files': ['.json'], 'subMetas': {},
    }
    d['subMetas']['f9941'] = {
        'importer': 'sprite-frame', 'uuid': sf_uuid,
        'displayName': png_path.stem, 'id': 'f9941', 'name': 'spriteFrame',
        'userData': {
            'trimType': 'none', 'trimThreshold': 1,
            'rotated': False, 'offsetX': 0, 'offsetY': 0,
            'trimX': 0, 'trimY': 0, 'width': W, 'height': H,
            'rawWidth': W, 'rawHeight': H,
            'borderTop': 0, 'borderBottom': 0, 'borderLeft': 0, 'borderRight': 0,
            'packable': True, 'pixelsToUnit': 100, 'pivotX': 0.5, 'pivotY': 0.5,
            'meshType': 0,
            'vertices': {
                'rawPosition': [-hw, -hh, 0,  hw, -hh, 0,  -hw, hh, 0,  hw, hh, 0],
                'indexes':     [0, 1, 2, 2, 1, 3],
                'uv':          [0, H, W, H, 0, 0, W, 0],
                'nuv':         [0, 0, 1, 0, 0, 1, 1, 1],
                'minPos':      [-hw, -hh, 0],
                'maxPos':      [hw, hh, 0],
            },
            'isUuid': True, 'imageUuidOrDatabaseUri': tex_uuid, 'atlasUuid': '',
        },
        'ver': '1.0.12', 'imported': True, 'files': ['.json'], 'subMetas': {},
    }
    meta_path.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding='utf-8')


DEMO_BASE = 98   # first demo card number; cards 98, 99, 100, … are all demo slots


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
    # remove any demo PNGs (98_A_opt1.png … 120_A_opt2.png range)
    removed = 0
    for num in range(DEMO_BASE, DEMO_BASE + 30):
        for opt in [1, 2]:
            png = VEC_DIR / f'{num:02d}_A_opt{opt}.png'
            if png.exists():
                png.unlink(); removed += 1
    if removed:
        print(f'  removed {removed} demo PNG(s)')
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

    # Pair up the whole collection sequentially → one card per pair.
    # Odd last item gets paired with the first item.
    pairs = []
    items = list(collection)
    while len(items) >= 2:
        pairs.append((items.pop(0), items.pop(0)))
    if items:   # one left over
        pairs.append((items[0], collection[0]))

    card_nums = list(range(DEMO_BASE, DEMO_BASE + len(pairs)))
    print(f'Creating {len(pairs)} demo cards ({card_nums[0]}–{card_nums[-1]}):')
    for i, (a, b) in enumerate(pairs):
        print(f'  card {card_nums[i]:02d}: opt1={a["name"]}  opt2={b["name"]}')

    # render PNGs
    VEC_DIR.mkdir(parents=True, exist_ok=True)
    for (a, b), num in zip(pairs, card_nums):
        for opt_idx, furn in enumerate([a, b], start=1):
            img = render_furniture(furn)
            out = VEC_DIR / f'{num:02d}_A_opt{opt_idx}.png'
            img.save(out)
            write_sprite_meta(out)
        print(f'  rendered {num:02d}_A_opt1.png + opt2.png')

    # patch furniture_data.json
    backup(FURN_JSON)
    fdata = load_json(FURN_JSON)
    fdata['cards'] = [c for c in fdata['cards'] if c['number'] not in card_nums]
    for (a, b), num in zip(pairs, card_nums):
        fdata['cards'].append(make_card_entry(a, b, num))
    save_json(FURN_JSON, fdata)
    print(f'  patched furniture_data.json (+{len(pairs)} demo cards)')

    # patch maps_data.json — all demo cards go into room I
    backup(MAPS_JSON)
    mdata = load_json(MAPS_JSON)
    training = next((s for s in mdata['scenarios'] if s['id'] == 'training'), None)
    if not training:
        print('WARNING: training scenario not found in maps_data.json')
    else:
        if training['rooms']:
            training['rooms'][0]['furniture_numbers'] = card_nums
            save_json(MAPS_JSON, mdata)
            room_name = training['rooms'][0].get('name_zh', training['rooms'][0]['slot'])
            print(f'  patched maps_data.json — room "{room_name}" → {card_nums}')

    print(f'\ndone — {len(pairs)} 轮二选一，等 Cocos 编译后运行预览')
    print('revert anytime:  python tools/demo_patch.py --revert')


main()
