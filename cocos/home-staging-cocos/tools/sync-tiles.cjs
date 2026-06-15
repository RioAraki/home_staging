// cocos/home-staging-cocos/tools/sync-tiles.cjs
// Copy the assembler tile sprites (asset/tiles/*.png) into the cocos resources
// so custom furniture can render with real tile art:
//   resources/tiles/<name>.png  → loaded via resources.load('tiles/<name>/spriteFrame')
// Run cocos reimport afterwards so the editor generates each .png.meta.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..'); // home_staging/
const SRC = path.join(ROOT, 'asset', 'tiles');
const DST = path.join(__dirname, '..', 'assets', 'resources', 'tiles');

fs.mkdirSync(DST, { recursive: true });
const pngs = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png'));
let copied = 0;
for (const f of pngs) {
  const src = path.join(SRC, f), dst = path.join(DST, f);
  // copy when missing or size/mtime differs
  let needs = true;
  try {
    const a = fs.statSync(src), b = fs.statSync(dst);
    if (a.size === b.size && a.mtimeMs <= b.mtimeMs) needs = false;
  } catch (_) { /* dst missing */ }
  if (needs) { fs.copyFileSync(src, dst); copied++; }
}
console.log(`synced ${copied}/${pngs.length} tiles -> ${DST}`);
