import type { MapsData, Scenario, FurnitureData, FurnitureCard } from './types';

let _mapsData: MapsData | null = null;
let _furnitureData: FurnitureData | null = null;

export function setLoadedData(maps: MapsData, furniture: FurnitureData) {
  // Normalize: editor-authored levels reference named furniture (`furniture`)
  // and may omit the legacy `furniture_numbers`. The current game reads
  // `furniture_numbers` everywhere, so guarantee it's an array — a room with no
  // numbers loads as an empty (0-card) room (map/walls still work) instead of
  // crashing on `furniture_numbers.length`. Named-furniture play comes later.
  for (const scenario of maps.scenarios) {
    for (const room of scenario.rooms) {
      if (!Array.isArray(room.furniture_numbers)) room.furniture_numbers = [];
    }
  }
  _mapsData = maps;
  _furnitureData = furniture;
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
