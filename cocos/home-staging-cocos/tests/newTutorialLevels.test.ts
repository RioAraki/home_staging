import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { computeRegions } from '../assets/scripts/core/regions';
import { preDrawnWallEdges, preDrawnRoomDoors, hasPrebuiltLayout } from '../assets/scripts/core/prebuilt';
import { furnitureOptionByName, setLoadedData } from '../assets/scripts/core/dataLoader';
import type { Scenario, MapsData, FurnitureData } from '../assets/scripts/core/types';

const testDir = dirname(fileURLToPath(import.meta.url));
const readScenario = (id: string): Scenario =>
  JSON.parse(readFileSync(resolve(testDir, `../../../md/scenarios/${id}.json`), 'utf-8'));
// The built library (furniture:library output) — this is what the game loads;
// asset/furniture_collection.json is the source and uses a different shape.
const library = JSON.parse(
  readFileSync(resolve(testDir, '../assets/resources/data/furniture_library.json'), 'utf-8'),
);
setLoadedData({ scenarios: [] } as unknown as MapsData,
              { cards: [] } as unknown as FurnitureData,
              library);

/** Regions the pre-built walls carve the indoor area into. */
const regionsOf = (s: Scenario) => {
  const walls: Record<string, true> = {};
  for (const k of preDrawnWallEdges(s)) walls[k] = true;
  return computeRegions(s, walls);
};

const indoorCount = (s: Scenario) =>
  s.grid.ascii.split('\n').join('').split('').filter((ch) => ch === 'I').length;

/** Cells of a region, as "r,c" strings. */
const cellsOf = (s: Scenario, r: number, c: number) => {
  const m = regionsOf(s);
  const id = m.cellToRegion.get(`${r},${c}`);
  return m.cellsByRegion.get(id!) ?? [];
};

describe('新增教学关：一室一厅 (mode ③, pre-built)', () => {
  const s = readScenario('living_room_and_bedroom');

  it('ships a pre-built layout', () => {
    expect(hasPrebuiltLayout(s)).toBe(true);
    expect(preDrawnWallEdges(s)).toEqual(['v:5:8', 'v:6:8', 'v:7:8', 'v:8:8', 'v:9:8']);
  });

  it('walls split the 30 indoor cells into exactly two 15-cell rooms', () => {
    expect(indoorCount(s)).toBe(30);
    const m = regionsOf(s);
    expect(m.regions.size).toBe(2);
    expect(cellsOf(s, 7, 5)).toHaveLength(15);   // 客厅 side
    expect(cellsOf(s, 7, 10)).toHaveLength(15);  // 卧室 side
    // …and they really are different regions.
    expect(m.cellToRegion.get('7,5')).not.toBe(m.cellToRegion.get('7,10'));
  });

  it('the bedroom door sits on the dividing wall and belongs to room II', () => {
    expect(preDrawnRoomDoors(s)).toEqual({ 'v:7:8': 'II' });
    expect(preDrawnWallEdges(s)).toContain('v:7:8');   // a door is still a wall
  });

  it('declares the living room as the hub, front door opening into it', () => {
    expect(s.rules.hallway).toMatchObject({ required: false, hub: 'I' });
    const fd = s.pre_drawn.doors.find((d) => d.target === 'front_door')!;
    expect(fd.cell).toEqual([7, 5]);   // west exterior wall of the living room
  });

  it('every room\'s furniture fits inside its own area', () => {
    for (const room of s.rooms) {
      const area = room.slot === 'I' ? 15 : 15;
      const used = (room.furniture ?? []).reduce((n, name) => {
        const o = furnitureOptionByName(name);
        expect(o, `missing furniture: ${name}`).toBeTruthy();
        return n + o!.shape.length + o!.open_spaces.length;
      }, 0);
      expect(used, `room ${room.slot}`).toBeLessThanOrEqual(area);
    }
  });
});

describe('新增教学关：三室一厅 (mode ③, pre-built)', () => {
  const s = readScenario('three_rooms_one_hall');

  it('splits 36 cells into 客厅18 / 卧室9 / 浴室9', () => {
    expect(indoorCount(s)).toBe(36);
    expect(regionsOf(s).regions.size).toBe(3);
    expect(cellsOf(s, 6, 5)).toHaveLength(18);    // 客厅 (cols 5-7, rows 4-9)
    expect(cellsOf(s, 5, 9)).toHaveLength(9);     // 卧室 (cols 8-10, rows 4-6)
    expect(cellsOf(s, 8, 9)).toHaveLength(9);     // 浴室 (cols 8-10, rows 7-9)
  });

  it('gives both side rooms a door onto the hub', () => {
    expect(preDrawnRoomDoors(s)).toEqual({ 'v:5:8': 'II', 'v:8:8': 'III' });
  });

  it('every room\'s furniture fits', () => {
    const area: Record<string, number> = { I: 18, II: 9, III: 9 };
    for (const room of s.rooms) {
      const used = (room.furniture ?? []).reduce((n, name) => {
        const o = furnitureOptionByName(name);
        expect(o, `missing furniture: ${name}`).toBeTruthy();
        return n + o!.shape.length + o!.open_spaces.length;
      }, 0);
      expect(used, `room ${room.slot}`).toBeLessThanOrEqual(area[room.slot]);
    }
  });
});

describe('新增教学关：走廊人家 (mode ①, pre-built)', () => {
  const s = readScenario('corridor_home');

  it('splits 35 cells into 15 / 5-corridor / 15', () => {
    expect(indoorCount(s)).toBe(35);
    expect(regionsOf(s).regions.size).toBe(3);
    expect(cellsOf(s, 7, 5)).toHaveLength(15);    // 卧室
    expect(cellsOf(s, 7, 8)).toHaveLength(5);     // 走廊
    expect(cellsOf(s, 7, 11)).toHaveLength(15);   // 起居室
  });

  it('both room doors open onto the corridor, not each other', () => {
    const doors = preDrawnRoomDoors(s);
    expect(doors).toEqual({ 'v:6:8': 'I', 'v:8:9': 'II' });
    const m = regionsOf(s);
    const corridor = m.cellToRegion.get('7,8');
    // Door "v:6:8" separates cell (6,7) from (6,8) — room I from the corridor.
    expect(m.cellToRegion.get('6,8')).toBe(corridor);
    expect(m.cellToRegion.get('6,7')).not.toBe(corridor);
    // Door "v:8:9" separates the corridor (8,8) from room II (8,9).
    expect(m.cellToRegion.get('8,8')).toBe(corridor);
    expect(m.cellToRegion.get('8,9')).not.toBe(corridor);
  });

  it('requires a hallway and puts the front door on the corridor', () => {
    expect(s.rules.hallway.required).toBe(true);
    const fd = s.pre_drawn.doors.find((d) => d.target === 'front_door')!;
    expect(fd.cell).toEqual([9, 8]);   // south exterior wall of the corridor
    expect(fd.edge).toBe('S');
  });
});

describe('自由版：同户型、无预置', () => {
  it.each([
    ['living_room_and_bedroom_free', 'living_room_and_bedroom'],
    ['corridor_home_free', 'corridor_home'],
  ])('%s reuses %s\'s grid but ships no layout', (freeId, srcId) => {
    const free = readScenario(freeId);
    const src = readScenario(srcId);
    expect(free.grid.ascii).toBe(src.grid.ascii);
    expect(free.rooms).toEqual(src.rooms);
    expect(hasPrebuiltLayout(free)).toBe(false);
    expect(preDrawnRoomDoors(free)).toEqual({});
    // The front door stays given, so the only new skill is drawing walls.
    expect(free.pre_drawn.doors.filter((d) => d.target === 'front_door')).toHaveLength(1);
  });
});
