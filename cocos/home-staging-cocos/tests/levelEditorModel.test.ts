import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// @ts-expect-error — plain ESM JS module, no types
import { emptyModel, buildScenario, parseScenario, buildGrid, parseGrid, validate } from '../../../tools/level-editor/model.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const readScenario = (id: string) =>
  JSON.parse(readFileSync(resolve(testDir, `../../../md/scenarios/${id}.json`), 'utf-8'));

describe('level-editor model', () => {
  it('grid terrain survives build→parse', () => {
    const m = emptyModel(4, 5);
    m.terrain[1][1] = 'indoor'; m.terrain[1][2] = 'indoor';
    m.terrain[2][2] = 'water'; m.feature[2][2] = null;
    m.terrain[0][0] = 'obstacle'; m.feature[0][0] = 'tree';
    const g = buildGrid(m);
    const back = parseGrid(g);
    expect(back.terrain).toEqual(m.terrain);
    expect(back.feature).toEqual(m.feature);
  });

  it('a fresh model round-trips build∘parse∘build identically', () => {
    const m = emptyModel(16, 16);
    m.meta = { id: 'demo_level', title_zh: '演示', title_en: 'Demo', chapter_zh: 'x', difficulty: 'easy', pages_in_book: [1], page_image: 'p.png' };
    for (let r = 4; r < 8; r++) for (let c = 4; c < 8; c++) m.terrain[r][c] = 'indoor';
    m.doors = ['h:4:5']; m.windows = ['v:6:4']; m.walls = ['v:5:6'];
    m.markers = [{ cell: [5, 5], id: 'socket', symbol: '*' }];
    m.rooms = [{ slot: 'I', name_zh: '客厅', name_en: 'Living', furniture: ['长沙发 1A-1', '长沙发 1A-1'] }];
    m.bonus_points = [{ text_zh: '盖住插座', text_en: 'cover socket', points: 2, condition: { covers_marker: { marker: 'socket' } } }];
    const b1 = buildScenario(m);
    const b2 = buildScenario(parseScenario(b1));
    expect(b2).toEqual(b1);
  });

  it('real scenarios survive parse→build→parse→build (idempotent, no field loss)', () => {
    for (const id of ['training', 'castle_cafe', 'game_store_old_town']) {
      const s = readScenario(id);
      const b1 = buildScenario(parseScenario(s));
      const b2 = buildScenario(parseScenario(b1));
      expect(b2).toEqual(b1);
      // unmanaged fields (e.g. zones, stats) preserved from the original
      expect(b1.zones).toEqual(s.zones ?? {});
      if (s.stats) expect(b1.stats).toEqual(s.stats);
    }
  });

  it('validate flags bad id, empty indoor, and unknown furniture (by name)', () => {
    const m = emptyModel(4, 4);
    let issues = validate(m, new Set(['长沙发 1A-1']));
    expect(issues.some((x: string) => x.includes('id'))).toBe(true);
    expect(issues.some((x: string) => x.includes('indoor'))).toBe(true);

    m.meta.id = 'good_id'; m.meta.title_zh = 'T';
    m.terrain[1][1] = 'indoor';
    m.rooms = [{ slot: 'I', name_zh: '房', name_en: 'R', furniture: ['不存在的家具'] }];
    issues = validate(m, new Set(['长沙发 1A-1']));
    expect(issues.some((x: string) => x.includes('不存在的家具'))).toBe(true);
  });
});
