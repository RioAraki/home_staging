// Build-time import of the YAML game data.
// The `?raw` flag is not used here — @rollup/plugin-yaml converts YAML
// directly to a JS object, which we then assert against our domain types.

import mapsRaw from '@data/maps_data.yaml';
import furnitureRaw from '@data/furniture_data.yaml';
import type { MapsData, Scenario, FurnitureData, FurnitureCard } from '../types';

export const mapsData = mapsRaw as MapsData;
export const furnitureData = furnitureRaw as FurnitureData;

export const scenarios: Scenario[] = mapsData.scenarios;
export const furnitureCards: FurnitureCard[] = furnitureData.cards;

export function scenarioById(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}

export function cardByNumberVariant(
  number: number,
  variant: 'A' | 'B',
): FurnitureCard | undefined {
  return furnitureCards.find((c) => c.number === number && c.variant === variant);
}

/** All cards (both variants) for a given furniture number. */
export function cardsForNumber(number: number): FurnitureCard[] {
  return furnitureCards.filter((c) => c.number === number);
}
