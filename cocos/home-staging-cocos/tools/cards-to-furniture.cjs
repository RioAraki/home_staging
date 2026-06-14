// cocos/home-staging-cocos/tools/cards-to-furniture.cjs
// Convert the numbered furniture cards (furniture_data.json) into NAMED
// furniture entries — one per (card, option) — so they unify with the
// assembler's custom named furniture (asset/furniture_collection.json).
// Output: asset/cards_furniture.json  { furniture: [...] }
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..'); // home_staging/
const SRC = path.join(__dirname, '..', 'assets', 'resources', 'data', 'furniture_data.json');
const OUT = path.join(ROOT, 'asset', 'cards_furniture.json');

const data = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
const furniture = [];
for (const card of data.cards) {
  card.options.forEach((opt, i) => {
    const tag = `${card.number}${card.variant}-${i + 1}`;
    furniture.push({
      name: `${opt.name_zh || ('#' + card.number)} ${tag}`,
      id: `${card.number}${card.variant}_${i + 1}`,
      source: 'card',
      number: card.number,
      variant: card.variant,
      option_index: opt.option_index,
      name_zh: opt.name_zh || '',
      name_en: opt.name_en || '',
      bbox: opt.bbox,
      shape: opt.shape,
      open_cells: opt.open_spaces || [],
      wall_edges: opt.wall_edges || [],
      printed_markers: opt.printed_markers || 0,
    });
  });
}

// uniqueness guard
const names = new Set(), ids = new Set();
for (const f of furniture) {
  if (names.has(f.name)) throw new Error(`duplicate name: ${f.name}`);
  if (ids.has(f.id)) throw new Error(`duplicate id: ${f.id}`);
  names.add(f.name); ids.add(f.id);
}

fs.writeFileSync(OUT, JSON.stringify({ furniture }, null, 2) + '\n', 'utf-8');
console.log(`converted ${furniture.length} card options -> ${OUT}`);
