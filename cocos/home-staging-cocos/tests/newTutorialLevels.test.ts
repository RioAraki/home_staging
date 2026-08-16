import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { computeRegions } from '../assets/scripts/core/regions';
import { preDrawnWallEdges, preDrawnRoomDoors, hasPrebuiltWalls, hasPrebuiltDoors } from '../assets/scripts/core/prebuilt';
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
    expect(hasPrebuiltWalls(s)).toBe(true);
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

describe('新增缓冲关：一大一小 (mode ③, 空间悬殊)', () => {
  const s = readScenario('big_room_small_room');

  it('splits 30 cells into a roomy 20 and a tight 10', () => {
    expect(indoorCount(s)).toBe(30);
    expect(regionsOf(s).regions.size).toBe(2);
    expect(cellsOf(s, 7, 5)).toHaveLength(20);    // 客厅 cols 5-8
    expect(cellsOf(s, 7, 10)).toHaveLength(10);   // 储物间 cols 9-10
  });

  it('the small room is genuinely tight but still solvable', () => {
    const used = (s.rooms.find((r) => r.slot === 'II')!.furniture ?? [])
      .reduce((n, name) => {
        const o = furnitureOptionByName(name)!;
        return n + o.shape.length + o.open_spaces.length;
      }, 0);
    expect(used).toBeLessThanOrEqual(10);   // fits …
    expect(used).toBeGreaterThanOrEqual(7); // … but only just — that's the lesson
  });

  it('every piece is narrow enough for the 2-wide room', () => {
    // The storage room is only 2 columns wide, so nothing may need 3+ cells
    // in BOTH directions — otherwise it cannot be placed even rotated.
    for (const name of s.rooms.find((r) => r.slot === 'II')!.furniture ?? []) {
      const o = furnitureOptionByName(name)!;
      expect(Math.min(o.bbox[0], o.bbox[1]), name).toBeLessThanOrEqual(2);
    }
  });
});

describe('新增缓冲关：L 形公寓 (不规则轮廓)', () => {
  const s = readScenario('l_shaped_flat');

  it('is genuinely L-shaped, not a rectangle', () => {
    expect(indoorCount(s)).toBe(27);
    const rows = s.grid.ascii.split('\n');
    const width = (r: number) => (rows[r].match(/I/g) ?? []).length;
    expect(width(5)).toBe(6);    // horizontal arm
    expect(width(9)).toBe(3);    // vertical arm — narrower, hence the L
  });

  it('splits into 客厅18 / 卧室9 with the bedroom on the wide arm', () => {
    expect(regionsOf(s).regions.size).toBe(2);
    expect(cellsOf(s, 9, 5)).toHaveLength(18);   // 客厅 spans both arms
    expect(cellsOf(s, 6, 9)).toHaveLength(9);    // 卧室 sits in the wide arm
  });

  it('puts the front door on the far end of the vertical arm', () => {
    const fd = s.pre_drawn.doors.find((d) => d.target === 'front_door')!;
    expect(fd.cell).toEqual([10, 5]);
    // …which is indoor, and its west neighbour is outdoor (a real exterior wall)
    const rows = s.grid.ascii.split('\n');
    expect(rows[10][5]).toBe('I');
    expect(rows[10][4]).toBe('.');
  });
});

describe('新增缓冲关：只差一扇门 (墙给定,门是练习)', () => {
  const s = readScenario('just_one_door');
  const src = readScenario('three_rooms_one_hall');

  it('reuses 三室一厅\'s plan and walls', () => {
    expect(s.grid.ascii).toBe(src.grid.ascii);
    expect(s.pre_drawn.walls_interior).toEqual(src.pre_drawn.walls_interior);
    expect(hasPrebuiltWalls(s)).toBe(true);
  });

  it('ships NO room doors — that is the exercise', () => {
    expect(preDrawnRoomDoors(s)).toEqual({});
    expect(hasPrebuiltDoors(s)).toBe(false);
    // The front door is still given, so the only new skill is cutting doors.
    expect(s.pre_drawn.doors.filter((d) => d.target === 'front_door')).toHaveLength(1);
  });

  it('still carves three separate rooms, so doors are actually needed', () => {
    expect(regionsOf(s).regions.size).toBe(3);
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
    expect(hasPrebuiltWalls(free)).toBe(false);
    expect(preDrawnRoomDoors(free)).toEqual({});
    // The front door stays given, so the only new skill is drawing walls.
    expect(free.pre_drawn.doors.filter((d) => d.target === 'front_door')).toHaveLength(1);
  });
});
