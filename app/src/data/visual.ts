// Visual-schema lookup for furniture options.

import visualRaw from '@data/furniture_visual.yaml';
import type { FurnitureVisual, FurnitureVisualData } from '../vector/types';

const visualData = visualRaw as FurnitureVisualData;
const entries: FurnitureVisual[] = visualData.entries ?? [];

const byKey = new Map<string, FurnitureVisual>();
for (const e of entries) {
  byKey.set(`${e.number}-${e.variant}-${e.option_index}`, e);
}

export function visualByKey(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
): FurnitureVisual | null {
  return byKey.get(`${number}-${variant}-${optionIndex}`) ?? null;
}

export const visualEntries = entries;
