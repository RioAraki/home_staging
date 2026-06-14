// cocos/home-staging-cocos/tools/scenarios-split.cjs
// ONE-TIME migration: split md/maps_data.yaml into per-level source files
//   md/scenarios/<id>.json   (one scenario each, the new source of truth)
//   md/scenarios/_index.json (ordered id list — preserves original order)
// After this, md/maps_data.yaml becomes a generated bundle (see scenarios-bundle.cjs).
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..', '..'); // home_staging/
const SRC = path.join(ROOT, 'md', 'maps_data.yaml');
const OUT_DIR = path.join(ROOT, 'md', 'scenarios');

const data = yaml.load(fs.readFileSync(SRC, 'utf-8'));
const scenarios = (data && data.scenarios) || [];
if (!scenarios.length) throw new Error('no scenarios found in maps_data.yaml');

fs.mkdirSync(OUT_DIR, { recursive: true });
const ids = [];
for (const s of scenarios) {
  if (!s.id) throw new Error('scenario missing id');
  if (ids.includes(s.id)) throw new Error(`duplicate scenario id: ${s.id}`);
  ids.push(s.id);
  fs.writeFileSync(path.join(OUT_DIR, `${s.id}.json`), JSON.stringify(s, null, 2) + '\n', 'utf-8');
}
fs.writeFileSync(path.join(OUT_DIR, '_index.json'), JSON.stringify(ids, null, 2) + '\n', 'utf-8');
console.log(`split ${ids.length} scenarios -> ${OUT_DIR}`);
