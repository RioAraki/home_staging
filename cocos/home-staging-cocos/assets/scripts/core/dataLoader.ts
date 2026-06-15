import type { MapsData, Scenario, FurnitureData, FurnitureCard, FurnitureOption } from './types';

/** One entry of the unified named-furniture library (furniture_library.json).
 *  `source:'card'` entries carry number/variant/option_index and reuse the
 *  numbered pipeline; `source:'custom'` entries are assembler-built from tiles. */
export interface FurnitureLibraryEntry {
  name: string;
  source: 'card' | 'custom';
  number?: number;
  variant?: 'A' | 'B';
  option_index?: number;
  bbox: [number, number];
  shape: Array<[number, number]>;
  open_spaces: Array<[number, number]>;
  wall_edges?: FurnitureOption['wall_edges'];
  name_zh?: string;
  printed_markers?: number;
  tiles?: Array<{ tile: string; col: number; row: number; rotation?: number; mirror?: boolean }>;
}

let _mapsData: MapsData | null = null;
let _furnitureData: FurnitureData | null = null;
let _furnitureLibrary: Map<string, FurnitureLibraryEntry> = new Map();

export function setLoadedData(
  maps: MapsData,
  furniture: FurnitureData,
  library?: { furniture: FurnitureLibraryEntry[] } | FurnitureLibraryEntry[],
) {
  // Safety net: guarantee furniture_numbers is an array so legacy code paths
  // that read it (and aren't routed through roomItems) never crash on
  // `.length`. Named-furniture rooms drive their flow via `furniture` names.
  for (const scenario of maps.scenarios) {
    for (const room of scenario.rooms) {
      if (!Array.isArray(room.furniture_numbers)) room.furniture_numbers = [];
    }
  }
  _mapsData = maps;
  _furnitureData = furniture;
  const entries = Array.isArray(library) ? library : (library?.furniture ?? []);
  _furnitureLibrary = new Map(entries.map((e) => [e.name, e]));
}

/** Look up a named-furniture library entry by its unique name. */
export function furnitureByName(name: string): FurnitureLibraryEntry | undefined {
  return _furnitureLibrary.get(name);
}

/** Resolve a named furniture to a FurnitureOption (the shape both the numbered
 *  and named pipelines consume). Returns null if the name is unknown. */
export function furnitureOptionByName(name: string): FurnitureOption | null {
  const e = _furnitureLibrary.get(name);
  if (!e) return null;
  return {
    option_index: e.option_index ?? 1,
    name_zh: e.name_zh ?? e.name,
    name_en: e.name,
    bbox: e.bbox,
    shape: e.shape,
    open_spaces: e.open_spaces,
    wall_edges: e.wall_edges ?? [],
    printed_markers: e.printed_markers ?? 0,
  };
}

function mapsData(): MapsData {
  if (!_mapsData) throw new Error('Data not loaded — call setLoadedData first.');
  return _mapsData;
}

function furnitureData(): FurnitureData {
  if (!_furnitureData) throw new Error('Data not loaded — call setLoadedData first.');
  return _furnitureData;
}

export const scenarios = (): Scenario[] => mapsData().scenarios;
export const furnitureCards = (): FurnitureCard[] => furnitureData().cards;

export function scenarioById(id: string): Scenario | undefined {
  return scenarios().find((s) => s.id === id);
}

/** Scenarios vetted for play, in display order (mirrors the web app's
 *  AVAILABLE_SCENARIO_IDS). Add an id here once a scenario has been
 *  smoke-tested in the Cocos build. */
export const AVAILABLE_SCENARIO_IDS = [
  'training',
  'alpine_wellness_hut',
  'mountain_surgery',
  'castle_cafe',
  'rehearsal_room_old_barn',
  'game_store_old_town',
  'test_0',   // editor-authored (named furniture; minimal-load — furniture not placeable yet)
];

export function availableScenarios(): Scenario[] {
  return AVAILABLE_SCENARIO_IDS
    .map((id) => scenarioById(id))
    .filter((s): s is Scenario => Boolean(s));
}

/** The scenario after `currentId` in the available list, or undefined when
 *  it is the last one (or not in the list). */
export function nextScenario(currentId: string): Scenario | undefined {
  const i = AVAILABLE_SCENARIO_IDS.indexOf(currentId);
  if (i < 0) return undefined;
  const nextId = AVAILABLE_SCENARIO_IDS[i + 1];
  return nextId ? scenarioById(nextId) : undefined;
}

export function cardByNumberVariant(
  number: number,
  variant: 'A' | 'B',
): FurnitureCard | undefined {
  return furnitureCards().find((c) => c.number === number && c.variant === variant);
}
