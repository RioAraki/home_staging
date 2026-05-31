import type { MapsData, Scenario, FurnitureData, FurnitureCard } from './types';

let _mapsData: MapsData | null = null;
let _furnitureData: FurnitureData | null = null;

export function setLoadedData(maps: MapsData, furniture: FurnitureData) {
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

export function cardByNumberVariant(
  number: number,
  variant: 'A' | 'B',
): FurnitureCard | undefined {
  return furnitureCards().find((c) => c.number === number && c.variant === variant);
}
