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
    m.doors = ['h:4:5']; m.windows = ['v:6:4']; m.walls = ['v:5:6']; m.frontDoor = 'h:8:5';
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

  it('keeps hallway.hub and notes when a scenario passes through the editor', () => {
    // castle_cafe is mode ③: hallway.required=false + hub "III" (用餐区).
    // The editor UI does not expose either field, so it must carry them through
    // untouched — a save used to silently drop them.
    const s = readScenario('castle_cafe');
    expect(s.rules.hallway.hub).toBe('III');
    expect(buildScenario(parseScenario(s)).rules.hallway).toEqual(s.rules.hallway);
  });

  it('omits hub for hallway-required scenarios', () => {
    const b = buildScenario(parseScenario(readScenario('training')));
    expect(b.rules.hallway.required).toBe(true);
    expect('hub' in b.rules.hallway).toBe(false);
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

  it('all six theme keys round-trip build→parse→build', () => {
    const m = emptyModel(4, 4);
    m.theme = {
      bg: [10, 20, 30], gridline: [40, 50, 60], wall: [70, 80, 90],
      door: [100, 110, 120], front_door: [130, 140, 150], window: [160, 170, 180],
    };
    const b = buildScenario(m);
    expect(b.theme).toEqual(m.theme);
    expect(parseScenario(b).theme).toEqual(m.theme);
  });

  it('partial theme (wall + door only) keeps those, omits the rest', () => {
    const m = emptyModel(4, 4);
    m.theme = { bg: null, gridline: null, wall: [1, 2, 3], door: [4, 5, 6], front_door: null, window: null };
    const b = buildScenario(m);
    expect(b.theme).toEqual({ wall: [1, 2, 3], door: [4, 5, 6] });
    expect(parseScenario(b).theme).toEqual({ bg: null, gridline: null, wall: [1, 2, 3], door: [4, 5, 6], front_door: null, window: null });
  });

  it('omits theme entirely when unset', () => {
    const b = buildScenario(emptyModel(4, 4));
    expect('theme' in b).toBe(false);
  });

  it('partial theme (only bg) keeps bg, omits gridline', () => {
    const m = emptyModel(4, 4);
    m.theme = { bg: [1, 2, 3], gridline: null };
    const b = buildScenario(m);
    expect(b.theme).toEqual({ bg: [1, 2, 3] });
    expect(parseScenario(b).theme).toEqual({ bg: [1, 2, 3], gridline: null, wall: null, door: null, front_door: null, window: null });
  });

  it('ignores malformed theme rgb (wrong length / non-number)', () => {
    const m = emptyModel(4, 4);
    m.theme = { bg: [1, 2], gridline: ['x', 0, 0] };
    const b = buildScenario(m);
    expect('theme' in b).toBe(false);
  });

  it('parseScenario defaults all six theme keys to null when scenario has no theme', () => {
    const b = buildScenario(emptyModel(4, 4));
    expect(parseScenario(b).theme).toEqual({ bg: null, gridline: null, wall: null, door: null, front_door: null, window: null });
  });

  it('ignores out-of-range theme rgb (channel > 255 or < 0)', () => {
    const m = emptyModel(4, 4);
    m.theme = { bg: [0, 0, 256], gridline: [-1, 0, 0] };
    const b = buildScenario(m);
    expect('theme' in b).toBe(false);
  });
});
