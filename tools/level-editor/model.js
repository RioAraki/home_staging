// Pure, engine-free transforms for the level editor.
// Imported by index.html (<script type="module">) and unit-tested under
// cocos/home-staging-cocos/tests/levelEditorModel.test.ts.
//
// The editor MODEL keeps the original scenario in `_raw` so any fields it
// doesn't manage (zones, stats, scoring, exotic keys) survive a load→save
// round-trip untouched. buildScenario starts from `_raw` and overwrites only
// the managed parts.

export const TERRAINS = ['indoor', 'outdoor', 'water', 'obstacle', 'road'];
export const FEATURES = ['tree', 'column', 'low_ceiling', 'lake', 'wall_pillar', 'charred'];

// Canonical single-char glyphs for plain (feature-less) terrain. Matches the
// book scenarios' convention ('.'=outdoor, 'I'=indoor).
const TERRAIN_GLYPH = { indoor: 'I', outdoor: '.', water: '~', obstacle: 'o', road: '=' };
const GLYPH_POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789'.split('');

// ── grid <-> ascii/legend ────────────────────────────────────────────────
export function buildGrid(model) {
  const { rows, cols, terrain, feature } = model;
  const legend = {};
  const comboChar = new Map();
  const used = new Set(Object.values(TERRAIN_GLYPH));
  const charFor = (terr, feat) => {
    const key = terr + '|' + (feat || '');
    if (comboChar.has(key)) return comboChar.get(key);
    let ch;
    if (!feat) ch = TERRAIN_GLYPH[terr] || '?';
    else ch = GLYPH_POOL.find((c) => !used.has(c)) || '?';
    used.add(ch);
    comboChar.set(key, ch);
    legend[ch] = feat ? { terrain: terr, feature: feat } : { terrain: terr };
    return ch;
  };
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) line += charFor(terrain[r][c], feature[r][c] || null);
    lines.push(line);
  }
  return { ascii: lines.join('\n'), legend };
}

export function parseGrid(grid) {
  const lines = (grid.ascii || '').replace(/\n+$/, '').split('\n');
  const rows = lines.length || 16;
  const cols = lines.reduce((m, l) => Math.max(m, l.length), 0) || 16;
  const terrain = [], feature = [];
  for (let r = 0; r < rows; r++) {
    terrain[r] = []; feature[r] = [];
    for (let c = 0; c < cols; c++) {
      const ch = lines[r]?.[c] ?? '.';
      const a = grid.legend?.[ch] || { terrain: 'outdoor' };
      terrain[r][c] = a.terrain || 'outdoor';
      feature[r][c] = a.feature || null;
    }
  }
  return { rows, cols, terrain, feature };
}

// ── edge keys <-> pre_drawn forms ────────────────────────────────────────
// 'h:r:c' = horizontal edge above cell (r,c) [between (r-1,c) and (r,c)]
// 'v:r:c' = vertical edge left of cell (r,c) [between (r,c-1) and (r,c)]
export function keyToDoor(key) {
  const [t, r, c] = key.split(':');
  return t === 'h'
    ? { cell: [+r, +c], edge: 'N' }
    : { cell: [+r, +c], edge: 'W' };
}
export function doorToKey(d) {
  const [r, c] = d.cell;
  switch (d.edge) {
    case 'N': return `h:${r}:${c}`;
    case 'S': return `h:${r + 1}:${c}`;
    case 'W': return `v:${r}:${c}`;
    case 'E': return `v:${r}:${c + 1}`;
    default: return `h:${r}:${c}`;
  }
}
export function keyToWallPair(key) {
  const [t, r, c] = key.split(':');
  return t === 'h' ? [+r - 1, +c, +r, +c] : [+r, +c - 1, +r, +c];
}
export function wallPairToKey([r1, c1, r2, c2]) {
  return r1 === r2 ? `v:${r1}:${Math.max(c1, c2)}` : `h:${Math.max(r1, r2)}:${c1}`;
}

// ── model <-> scenario ───────────────────────────────────────────────────
export function emptyModel(rows = 16, cols = 16) {
  const terrain = [], feature = [];
  for (let r = 0; r < rows; r++) {
    terrain[r] = Array(cols).fill('outdoor');
    feature[r] = Array(cols).fill(null);
  }
  return {
    meta: { id: '', title_zh: '', title_en: '', chapter_zh: '', difficulty: 'medium', pages_in_book: [], page_image: '' },
    rows, cols, terrain, feature,
    doors: [], windows: [], walls: [], markers: [],
    rooms: [],
    rules: { hallway_required: true, front_door: { mode: 'anywhere', forced_edges: [], forced_cells: [], width: 1 }, drawing: [] },
    bonus_points: [],
    _raw: {},
  };
}

export function parseScenario(s) {
  const g = parseGrid(s.grid || { ascii: '', legend: {} });
  const pd = s.pre_drawn || {};
  const fd = s.rules?.front_door || {};
  let mode = 'anywhere';
  if (fd.forced_edges?.length) mode = 'forced_edges';
  else if (fd.forced_cells?.length) mode = 'forced_cells';
  return {
    meta: {
      id: s.id || '', title_zh: s.title_zh || '', title_en: s.title_en || '',
      chapter_zh: s.chapter_zh || '', difficulty: s.difficulty || 'medium',
      pages_in_book: s.pages_in_book || [], page_image: s.page_image || '',
    },
    rows: g.rows, cols: g.cols, terrain: g.terrain, feature: g.feature,
    doors: (pd.doors || []).map(doorToKey),
    windows: (pd.windows || []).map(doorToKey),
    walls: (pd.walls_interior || []).map(wallPairToKey),
    markers: (pd.markers || []).map((m) => ({ cell: m.cell, id: m.id, symbol: m.symbol })),
    rooms: (s.rooms || []).map((r) => ({
      slot: r.slot, name_zh: r.name_zh || '', name_en: r.name_en || '',
      furniture: [...(r.furniture || [])],           // named furniture (new)
      _numbers: [...(r.furniture_numbers || [])],    // legacy card numbers (preserved)
    })),
    rules: {
      hallway_required: s.rules?.hallway?.required !== false,
      front_door: {
        mode,
        forced_edges: fd.forced_edges || [],
        forced_cells: fd.forced_cells || [],
        width: fd.width || 1,
      },
      drawing: s.rules?.drawing || [],
    },
    bonus_points: (s.bonus_points || []).map((b) => ({
      text_zh: b.text_zh || '', text_en: b.text_en || '', points: b.points || 0,
      condition: b.condition,
    })),
    _raw: JSON.parse(JSON.stringify(s)),
  };
}

export function buildScenario(m) {
  const grid = buildGrid(m);
  const pre_drawn = {
    doors: m.doors.map(keyToDoor),
    windows: m.windows.map(keyToDoor),
    walls_interior: m.walls.map(keyToWallPair),
  };
  if (m.markers.length) {
    pre_drawn.markers = m.markers.map((mk) => (mk.symbol ? { cell: mk.cell, id: mk.id, symbol: mk.symbol } : { cell: mk.cell, id: mk.id }));
  }
  const fd = m.rules.front_door;
  const front_door = { on_exterior_wall_anywhere: fd.mode === 'anywhere', forced_cells: fd.mode === 'forced_cells' ? fd.forced_cells : [] };
  if (fd.mode === 'forced_edges') front_door.forced_edges = fd.forced_edges;
  if (fd.width && fd.width !== 1) front_door.width = fd.width;
  const rules = {
    hallway: { required: m.rules.hallway_required },
    front_door,
    drawing: m.rules.drawing || [],
    scoring: m._raw.rules?.scoring || [],
  };
  const bonus_points = m.bonus_points.map((b) => {
    const o = { text_zh: b.text_zh, text_en: b.text_en, points: b.points };
    if (b.condition !== undefined) o.condition = b.condition;
    return o;
  });
  // start from _raw so unmanaged fields (zones, stats, …) survive
  return {
    ...m._raw,
    id: m.meta.id,
    title_zh: m.meta.title_zh,
    title_en: m.meta.title_en,
    chapter_zh: m.meta.chapter_zh,
    difficulty: m.meta.difficulty,
    pages_in_book: m.meta.pages_in_book,
    page_image: m.meta.page_image,
    rooms: m.rooms.map((r) => {
      const base = { slot: r.slot, name_zh: r.name_zh, name_en: r.name_en };
      if ((r.furniture || []).length) return { ...base, furniture: r.furniture };
      if ((r._numbers || []).length) return { ...base, furniture_numbers: r._numbers };
      return { ...base, furniture: [] };
    }),
    grid,
    zones: m._raw.zones || {},
    pre_drawn,
    rules,
    bonus_points,
  };
}

// ── validation ───────────────────────────────────────────────────────────
// `validFurnitureNames` — a Set/array of valid named-furniture names (unified
// library = custom collection + card-converted). Empty/omitted skips the check.
export function validate(m, validFurnitureNames) {
  const issues = [];
  const ok = (cond, msg) => { if (!cond) issues.push(msg); };

  ok(/^[a-z0-9_]+$/.test(m.meta.id), 'id 必须是非空 slug（小写字母/数字/下划线）');
  ok(!!m.meta.title_zh, '缺少中文标题 title_zh');

  // indoor non-empty + connectivity
  let indoor = 0; const indoorCells = [];
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    if (m.terrain[r][c] === 'indoor') { indoor++; indoorCells.push(r * m.cols + c); }
  }
  ok(indoor > 0, '没有任何 indoor 格子');
  if (indoor > 0) {
    const set = new Set(indoorCells);
    const start = indoorCells[0];
    const seen = new Set([start]); const q = [start];
    while (q.length) {
      const k = q.shift(); const r = Math.floor(k / m.cols), c = k % m.cols;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const nk = nr * m.cols + nc;
        if (nr >= 0 && nc >= 0 && nr < m.rows && nc < m.cols && set.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); }
      }
    }
    ok(seen.size === indoor, `indoor 区域不连通（${indoor - seen.size} 格与主区域分离）`);
  }

  // rooms / furniture (by name, against the unified library)
  const valid = validFurnitureNames instanceof Set ? validFurnitureNames : new Set(validFurnitureNames || []);
  const slots = new Set();
  for (const room of m.rooms) {
    ok(!slots.has(room.slot), `房间 slot 重复：${room.slot}`);
    slots.add(room.slot);
    ok(!!room.name_zh, `房间 ${room.slot} 缺少中文名`);
    for (const n of (room.furniture || [])) {
      if (valid.size) ok(valid.has(n), `房间 ${room.slot} 引用了不存在的家具：${n}`);
    }
  }

  // bonus marker references
  const markerIds = new Set(m.markers.map((mk) => mk.id));
  for (const b of m.bonus_points) {
    const mk = b.condition && b.condition.covers_marker && b.condition.covers_marker.marker;
    if (mk) ok(markerIds.has(mk), `奖励引用了不存在的 marker：${mk}`);
  }

  return issues;
}
