import { describe, it, expect, beforeAll } from 'vitest';
import { setLoadedData, furnitureByName, furnitureOptionByName } from '../assets/scripts/core/dataLoader';
import { resolveOption, pieceShapeCells, pieceOpenSpaceCells } from '../assets/scripts/core/pieces';
import { roomItems, roomItemCount, isNamedRoom } from '../assets/scripts/core/roomItems';
import type { MapsData, FurnitureData } from '../assets/scripts/core/types';

const maps = { scenarios: [] } as unknown as MapsData;
const furniture = {
  cards: [{
    number: 1, variant: 'A', image: '',
    options: [{ option_index: 1, name_zh: '编号家具', name_en: 'n', bbox: [1, 1], shape: [[0, 0]], open_spaces: [], wall_edges: [], printed_markers: 0 }],
  }],
} as unknown as FurnitureData;
const library = {
  furniture: [
    { name: '长沙发', source: 'custom', bbox: [2, 4], shape: [[0, 0], [0, 1], [0, 2], [0, 3]], open_spaces: [[1, 0], [1, 1], [1, 2], [1, 3]], tiles: [] },
    { name: '马桶 8A-1', source: 'card', number: 8, variant: 'A', option_index: 1, bbox: [1, 2], shape: [[0, 1]], open_spaces: [[0, 0]], name_zh: '马桶' },
  ],
};

beforeAll(() => setLoadedData(maps, furniture, library as any));

describe('named furniture resolution', () => {
  it('furnitureByName / furnitureOptionByName return the entry shape', () => {
    expect(furnitureByName('长沙发')?.source).toBe('custom');
    const opt = furnitureOptionByName('长沙发')!;
    expect(opt.bbox).toEqual([2, 4]);
    expect(opt.shape.length).toBe(4);
    expect(furnitureOptionByName('不存在')).toBeNull();
  });

  it('resolveOption resolves a CUSTOM named piece by name → world shape cells', () => {
    const p = { name: '长沙发', source: 'custom', number: 0, variant: 'A', optionIndex: 1, rotation: 0, mirrored: false, origin: [5, 5] } as const;
    expect(resolveOption(p)?.shape.length).toBe(4);
    expect(pieceShapeCells(p)).toEqual([[5, 5], [5, 6], [5, 7], [5, 8]]);
    expect(pieceOpenSpaceCells(p)).toEqual([[6, 5], [6, 6], [6, 7], [6, 8]]);
  });

  it('resolveOption resolves a CARD-derived named piece by name', () => {
    const p = { name: '马桶 8A-1', source: 'card', number: 8, variant: 'A', optionIndex: 1, rotation: 0, mirrored: false, origin: [3, 3] } as const;
    expect(pieceShapeCells(p)).toEqual([[3, 4]]);
    expect(pieceOpenSpaceCells(p)).toEqual([[3, 3]]);
  });

  it('numbered pieces (no name) still resolve via cardByNumberVariant', () => {
    const p = { number: 1, variant: 'A', optionIndex: 1, rotation: 0, mirrored: false, origin: [2, 2] } as const;
    expect(pieceShapeCells(p)).toEqual([[2, 2]]);
  });
});

describe('roomItems', () => {
  it('named room → named items', () => {
    const room = { furniture: ['长沙发', '马桶 8A-1'], furniture_numbers: [] };
    expect(isNamedRoom(room)).toBe(true);
    expect(roomItemCount(room)).toBe(2);
    expect(roomItems(room)).toEqual([{ kind: 'named', name: '长沙发' }, { kind: 'named', name: '马桶 8A-1' }]);
  });
  it('numbered room → numbered items', () => {
    const room = { furniture_numbers: [2, 19] };
    expect(isNamedRoom(room)).toBe(false);
    expect(roomItems(room)).toEqual([{ kind: 'numbered', number: 2 }, { kind: 'numbered', number: 19 }]);
  });
  it('empty room → no items', () => {
    expect(roomItems({})).toEqual([]);
  });
});
