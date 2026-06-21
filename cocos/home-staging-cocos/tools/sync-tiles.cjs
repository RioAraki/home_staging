// cocos/home-staging-cocos/tools/sync-tiles.cjs
// Copy the assembler tile sprites (asset/tiles/*.png) into the cocos resources
// so custom furniture can render with real tile art:
//   resources/tiles/<name>.png  → loaded via resources.load('tiles/<name>/spriteFrame')
//
// We ALSO write each tile's .png.meta with trimType:none. Cocos's default import
// trimType is "auto", which crops a tile's transparent margins; the renderer then
// draws every tile at a fixed 100x100 cell (Sprite sizeMode CUSTOM), so the cropped
// art gets stretched back to fill the cell → distortion. trimType:none keeps the
// full frame, so art that intentionally doesn't fill the tile renders correctly.
// (Same effect as tools/demo_patch.py write_sprite_meta — kept in sync here so a
// plain `npm run sync:tiles` never re-introduces the stretch bug.)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..'); // home_staging/
const SRC = path.join(ROOT, 'asset', 'tiles');
const DST = path.join(__dirname, '..', 'assets', 'resources', 'tiles');

// Read width/height straight from the PNG IHDR (no image lib needed).
function pngSize(file) {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, buf, 0, 24, 0); } finally { fs.closeSync(fd); }
  if (buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`not a PNG: ${file}`);
  return { W: buf.readUInt32BE(16), H: buf.readUInt32BE(20) };
}

// Does this tile's .meta need a trimType:none rewrite?
//   - missing/unreadable meta            → yes (write a fresh one)
//   - a TRIMMED sprite-frame not on none → yes (this is the one that stretches)
//   - already none, or auto-but-untrimmed (renders fine) → no (avoid needless churn)
function metaNeedsTrimFix(metaPath) {
  let sf;
  try { sf = JSON.parse(fs.readFileSync(metaPath, 'utf8')).subMetas?.f9941?.userData; }
  catch (_) { return true; }
  if (!sf) return true;
  if (sf.trimType === 'none') return false;
  return sf.width !== sf.rawWidth || sf.height !== sf.rawHeight;
}

// Write a trimType:none sprite-frame .meta, preserving the existing uuid when present.
function writeTileMeta(pngPath) {
  const metaPath = pngPath + '.meta';
  const { W, H } = pngSize(pngPath);
  const hw = W / 2, hh = H / 2;
  const stem = path.basename(pngPath, '.png');

  let uid;
  if (fs.existsSync(metaPath)) {
    try { uid = JSON.parse(fs.readFileSync(metaPath, 'utf8')).uuid; } catch (_) { /* regen */ }
  }
  if (!uid) uid = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const tex = `${uid}@6c48a`, sf = `${uid}@f9941`;

  const d = {
    ver: '1.0.27', importer: 'image', imported: true, uuid: uid, files: ['.json', '.png'],
    subMetas: {
      '6c48a': {
        importer: 'texture', uuid: tex, displayName: stem, id: '6c48a', name: 'texture',
        userData: {
          wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', imageUuidOrDatabaseUri: uid,
          isUuid: true, visible: false, minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0,
        },
        ver: '1.0.22', imported: true, files: ['.json'], subMetas: {},
      },
      'f9941': {
        importer: 'sprite-frame', uuid: sf, displayName: stem, id: 'f9941', name: 'spriteFrame',
        userData: {
          trimType: 'none', trimThreshold: 1, rotated: false, offsetX: 0, offsetY: 0,
          trimX: 0, trimY: 0, width: W, height: H, rawWidth: W, rawHeight: H,
          borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0,
          packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
          vertices: {
            rawPosition: [-hw, -hh, 0, hw, -hh, 0, -hw, hh, 0, hw, hh, 0],
            indexes: [0, 1, 2, 2, 1, 3],
            uv: [0, H, W, H, 0, 0, W, 0],
            nuv: [0, 0, 1, 0, 0, 1, 1, 1],
            minPos: [-hw, -hh, 0], maxPos: [hw, hh, 0],
          },
          isUuid: true, imageUuidOrDatabaseUri: tex, atlasUuid: '',
        },
        ver: '1.0.12', imported: true, files: ['.json'], subMetas: {},
      },
    },
    userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: false, hasAlpha: true, redirect: tex },
  };
  fs.writeFileSync(metaPath, JSON.stringify(d, null, 2), 'utf-8');
}

fs.mkdirSync(DST, { recursive: true });
const pngs = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png'));
let copied = 0, metas = 0;
for (const f of pngs) {
  const src = path.join(SRC, f), dst = path.join(DST, f);
  // copy when missing or size/mtime differs
  let needsCopy = true;
  try {
    const a = fs.statSync(src), b = fs.statSync(dst);
    if (a.size === b.size && a.mtimeMs <= b.mtimeMs) needsCopy = false;
  } catch (_) { /* dst missing */ }
  if (needsCopy) { fs.copyFileSync(src, dst); copied++; }
  // ensure trimType:none meta on new tiles (and self-heal any trimmed auto tile)
  if (needsCopy || metaNeedsTrimFix(dst + '.meta')) { writeTileMeta(dst); metas++; }
}
console.log(`synced ${copied}/${pngs.length} tiles, wrote ${metas} trimType:none .meta -> ${DST}`);
