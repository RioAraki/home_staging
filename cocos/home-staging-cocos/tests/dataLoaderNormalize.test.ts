import { describe, it, expect } from 'vitest';
import { setLoadedData, scenarioById } from '../assets/scripts/core/dataLoader';
import type { MapsData, FurnitureData } from '../assets/scripts/core/types';

const furniture = { cards: [] } as unknown as FurnitureData;

describe('setLoadedData furniture_numbers normalization', () => {
  it('fills furniture_numbers=[] for named-furniture rooms (no crash on .length)', () => {
    const maps = {
      scenarios: [{
        id: 'named_lvl',
        rooms: [
          { slot: 'I', name_zh: '室', name_en: 'R', furniture: ['长沙发', '马桶 8A-1'] },
          { slot: 'II', name_zh: '室2', name_en: 'R2', furniture_numbers: [2, 3] },
        ],
      }],
    } as unknown as MapsData;

    setLoadedData(maps, furniture);
    const s = scenarioById('named_lvl')!;
    expect(Array.isArray(s.rooms[0].furniture_numbers)).toBe(true);
    expect(s.rooms[0].furniture_numbers).toEqual([]);     // named room → empty (0 cards)
    expect(s.rooms[0].furniture).toEqual(['长沙发', '马桶 8A-1']); // names preserved
    expect(s.rooms[1].furniture_numbers).toEqual([2, 3]);  // legacy untouched
  });
});
