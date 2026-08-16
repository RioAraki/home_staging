import { describe, it, expect } from 'vitest';
import { preDrawnWallEdges, preDrawnRoomDoors, hasPrebuiltLayout } from '../assets/scripts/core/prebuilt';
import type { Scenario } from '../assets/scripts/core/types';

const scen = (pre: Partial<Scenario['pre_drawn']>): Scenario => ({
  pre_drawn: { doors: [], windows: [], walls_interior: [], ...pre },
} as unknown as Scenario);

describe('preDrawnWallEdges', () => {
  it('converts vertical cell pairs to v: edge keys', () => {
    // [r, c-1, r, c] is the level editor's encoding of edge "v:r:c".
    expect(preDrawnWallEdges(scen({ walls_interior: [[5, 7, 5, 8]] }))).toEqual(['v:5:8']);
  });

  it('converts horizontal cell pairs to h: edge keys', () => {
    // [r-1, c, r, c] is the level editor's encoding of edge "h:r:c".
    expect(preDrawnWallEdges(scen({ walls_interior: [[6, 8, 7, 8]] }))).toEqual(['h:7:8']);
  });

  it('is order-insensitive within a pair', () => {
    expect(preDrawnWallEdges(scen({ walls_interior: [[5, 8, 5, 7]] }))).toEqual(['v:5:8']);
    expect(preDrawnWallEdges(scen({ walls_interior: [[7, 8, 6, 8]] }))).toEqual(['h:7:8']);
  });

  it('drops non-adjacent pairs instead of inventing an edge', () => {
    // Diagonal and 2-apart pairs share no edge.
    expect(preDrawnWallEdges(scen({ walls_interior: [[5, 5, 6, 6], [5, 5, 5, 7]] }))).toEqual([]);
  });

  it('round-trips a whole wall run', () => {
    const run: Array<[number, number, number, number]> =
      [[5, 7, 5, 8], [6, 7, 6, 8], [7, 7, 7, 8], [8, 7, 8, 8], [9, 7, 9, 8]];
    expect(preDrawnWallEdges(scen({ walls_interior: run })))
      .toEqual(['v:5:8', 'v:6:8', 'v:7:8', 'v:8:8', 'v:9:8']);
  });

  it('returns nothing for scenarios without pre-built walls', () => {
    expect(preDrawnWallEdges(scen({}))).toEqual([]);
  });
});

describe('preDrawnRoomDoors', () => {
  it('maps doors carrying a room to edge key → slot', () => {
    const s = scen({ doors: [{ cell: [7, 8], edge: 'W', room: 'II' }] as any });
    expect(preDrawnRoomDoors(s)).toEqual({ 'v:7:8': 'II' });
  });

  it('ignores the front door and decorative doors', () => {
    const s = scen({
      doors: [
        { cell: [7, 5], edge: 'W', target: 'front_door' },
        { cell: [6, 8], edge: 'N' },                        // no room → decorative
        { cell: [7, 8], edge: 'W', room: 'II' },
      ] as any,
    });
    expect(preDrawnRoomDoors(s)).toEqual({ 'v:7:8': 'II' });
  });

  it('ignores a door that claims a room but is also the front door', () => {
    const s = scen({ doors: [{ cell: [7, 5], edge: 'W', room: 'I', target: 'front_door' }] as any });
    expect(preDrawnRoomDoors(s)).toEqual({});
  });
});

describe('hasPrebuiltLayout', () => {
  it('is true only when interior walls are shipped', () => {
    expect(hasPrebuiltLayout(scen({ walls_interior: [[5, 7, 5, 8]] }))).toBe(true);
    expect(hasPrebuiltLayout(scen({}))).toBe(false);
    expect(hasPrebuiltLayout(null)).toBe(false);
  });

  it('is true for exactly the three pre-built tutorial levels', async () => {
    // Guards both directions: the flag must skip the wall phase for the new
    // tutorial levels, and must NOT start skipping it for any older level.
    const PREBUILT = new Set([
      'living_room_and_bedroom', 'three_rooms_one_hall', 'corridor_home',
    ]);
    const { readFileSync, readdirSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../md/scenarios');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json') && n !== '_index.json')) {
      const s = JSON.parse(readFileSync(resolve(dir, f), 'utf-8'));
      expect(hasPrebuiltLayout(s), f).toBe(PREBUILT.has(s.id));
    }
  });
});
