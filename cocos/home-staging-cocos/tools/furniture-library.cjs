// cocos/home-staging-cocos/tools/furniture-library.cjs
// Merge the named-furniture sources into one library the GAME loads:
//   asset/cards_furniture.json      (132 card-derived, carry number/variant/option_index)
//   asset/furniture_collection.json (assembler custom, composed of tiles)
// → cocos/.../assets/resources/data/furniture_library.json   { furniture: [...] }
//
// Card entries keep number/variant/option_index so they reuse the whole numbered
// pipeline (geometry, scoring, carpet, vector-PNG render). Custom entries derive
// `shape` from their tile cells and carry `tiles` for footprint rendering.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..'); // home_staging/
const CARDS = path.join(ROOT, 'asset', 'cards_furniture.json');
const CUSTOM = path.join(ROOT, 'asset', 'furniture_collection.json');
const OUT = path.join(__dirname, '..', 'assets', 'resources', 'data', 'furniture_library.json');

const readArr = (p) => {
  if (!fs.existsSync(p)) return [];
  const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return d.furniture || (Array.isArray(d) ? d : []);
};

const out = [];
const seen = new Set();
const add = (e) => { if (e && e.name && !seen.has(e.name)) { seen.add(e.name); out.push(e); } };

// custom first (wins on name collision)
for (const f of readArr(CUSTOM)) {
  add({
    name: f.name,
    source: 'custom',
    bbox: f.bbox,
    shape: (f.tiles || []).map((t) => [t.row, t.col]),
    open_spaces: f.open_cells || [],
    wall_edges: f.wall_edges || [],
    name_zh: f.name,
    tiles: f.tiles || [],
  });
}
for (const f of readArr(CARDS)) {
  add({
    name: f.name,
    source: 'card',
    number: f.number,
    variant: f.variant,
    option_index: f.option_index,
    bbox: f.bbox,
    shape: f.shape,
    open_spaces: f.open_cells || f.open_spaces || [],
    wall_edges: f.wall_edges || [],
    name_zh: f.name_zh || f.name,
    printed_markers: f.printed_markers || 0,
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ furniture: out }, null, 2) + '\n', 'utf-8');
console.log(`furniture library: ${out.length} entries (custom + card) -> ${OUT}`);
