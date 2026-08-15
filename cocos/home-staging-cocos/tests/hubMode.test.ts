import { describe, it, expect, beforeAll } from 'vitest';
import { setLoadedData } from '../assets/scripts/core/dataLoader';
import { analyseAccessibility } from '../assets/scripts/core/regions';
import type { MapsData, FurnitureData, Scenario, PlacedPiece } from '../assets/scripts/core/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────
// One indoor row of 6 cells (row 1, cols 1..6), split by two interior walls
// into three 2-cell rooms:
//
//        col: 1  2 │ 3  4 │ 5  6
//             [II ]│[ I  ]│[III]
//                  ↑      ↑
//              v:1:3   v:1:5
//
// Room I sits in the middle, so both II and III are adjacent to it — the
// classic living-room-hub layout.
const maps = { scenarios: [] } as unknown as MapsData;
const furniture = { cards: [] } as unknown as FurnitureData;
const library = {
  furniture: [
    { name: '点', source: 'custom', bbox: [1, 1], shape: [[0, 0]], open_spaces: [], tiles: [] },
  ],
};

beforeAll(() => setLoadedData(maps, furniture, library as any));

function scenario(hallway: Scenario['rules']['hallway']): Scenario {
  return {
    id: 'hub-fixture',
    title_zh: '', title_en: '', chapter_zh: '', difficulty: 'training',
    pages_in_book: [], page_image: '',
    rooms: [
      { slot: 'I', name_zh: '客厅', name_en: '', furniture: ['点'] },
      { slot: 'II', name_zh: '卧室', name_en: '', furniture: ['点'] },
      { slot: 'III', name_zh: '浴室', name_en: '', furniture: ['点'] },
    ],
    grid: {
      ascii: '........\n.IIIIII.\n........',
      legend: { '.': { terrain: 'outdoor' }, I: { terrain: 'indoor' } },
    },
    zones: {},
    pre_drawn: { doors: [], windows: [], walls_interior: [] },
    rules: {
      hallway,
      front_door: { on_exterior_wall_anywhere: true, forced_cells: [] },
      drawing: [], scoring: [],
    },
    bonus_points: [],
  } as unknown as Scenario;
}

const piece = (slot: string, col: number): PlacedPiece => ({
  name: '点', source: 'custom', number: 0, variant: 'A', optionIndex: 1,
  rotation: 0, mirrored: false, origin: [1, col], roomSlot: slot,
} as unknown as PlacedPiece);

const PIECES = [piece('II', 1), piece('I', 3), piece('III', 5)];
const WALLS = { 'v:1:3': true as const, 'v:1:5': true as const };
/** Front door on room I's south exterior wall (row 1 → row 2 is outdoor). */
const FRONT_DOOR_AT_I = 'h:2:3';
/** Front door on room II's south exterior wall — makes II the lobby instead. */
const FRONT_DOOR_AT_II = 'h:2:1';

const analyse = (
  hallway: Scenario['rules']['hallway'],
  doors: Record<string, string>,
  frontDoor: string = FRONT_DOOR_AT_I,
) => analyseAccessibility(
  scenario(hallway), PIECES, WALLS, doors as any, frontDoor,
);

// ── Tests ────────────────────────────────────────────────────────────────────
describe('mode ③ (living-room hub) door validation', () => {
  it('accepts every room opening onto the hub room', () => {
    const res = analyse(
      { required: false, hub: 'I' },
      { 'v:1:3': 'II', 'v:1:5': 'III' },   // both doors face room I
    );
    expect(res.doorIssues).toEqual([]);
  });

  it('rejects a room chaining through a non-hub room', () => {
    // Same geometry, but the hub is declared to be II. Room III's door then
    // opens into I — which is neither the hub nor III itself → illegal chain.
    const res = analyse(
      { required: false, hub: 'II' },
      { 'v:1:3': 'II', 'v:1:5': 'III' },
    );
    expect(res.doorIssues).toHaveLength(1);
    expect(res.doorIssues[0].roomSlot).toBe('III');
    expect(res.doorIssues[0].reason).toMatch(/hub/i);
  });

  it('does not restrict the hub room\'s own doors', () => {
    // Door on v:1:3 owned by the hub itself (I) opening into II is fine —
    // it is the same physical "II connects to the living room" doorway.
    const res = analyse(
      { required: false, hub: 'I' },
      { 'v:1:3': 'I', 'v:1:5': 'III' },
    );
    expect(res.doorIssues).toEqual([]);
  });

  it('stays silent when the scenario declares no hub (legacy data)', () => {
    const res = analyse(
      { required: false },
      { 'v:1:3': 'II', 'v:1:5': 'III' },
    );
    expect(res.doorIssues).toEqual([]);
  });

  it('flags a door into a non-hub room even when the hub has no pieces yet', () => {
    // Hub II declared, but room II's own region is only known via its pieces —
    // it has one, so the check is live. III → I is still a chain.
    const res = analyse(
      { required: false, hub: 'II' },
      { 'v:1:5': 'III' },
    );
    expect(res.doorIssues).toHaveLength(1);
    expect(res.doorIssues[0].roomSlot).toBe('III');
  });
});

describe('mode ① (hallway required) — unchanged behaviour', () => {
  it('flags a door opening into another room', () => {
    // Front door sits on room II, so room I is NOT the lobby; room III's door
    // into room I is a plain room-to-room opening → illegal.
    const res = analyse(
      { required: true },
      { 'v:1:5': 'III' },
      FRONT_DOOR_AT_II,
    );
    expect(res.doorIssues).toHaveLength(1);
    expect(res.doorIssues[0].roomSlot).toBe('III');
  });

  it('allows a door into the lobby (the room the front door opens into)', () => {
    // Documents the existing lobby exception: with the front door on room I,
    // room III may open into I even though I is a room. Training relies on it.
    const res = analyse(
      { required: true },
      { 'v:1:5': 'III' },
      FRONT_DOOR_AT_I,
    );
    expect(res.doorIssues).toEqual([]);
  });
});
