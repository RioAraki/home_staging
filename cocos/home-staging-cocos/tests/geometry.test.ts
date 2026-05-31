import { describe, it, expect } from 'vitest';
import { transformOption } from '../assets/scripts/core/geometry';
import type { FurnitureOption } from '../assets/scripts/core/types';

// L-shape: top-left + top-middle + bottom-left
const L: FurnitureOption = {
  option_index: 1,
  name_zh: 'L', name_en: 'L',
  bbox: [2, 2],
  shape: [[0, 0], [0, 1], [1, 0]],
  open_spaces: [],
  wall_edges: [],
  printed_markers: 0,
};

describe('transformOption', () => {
  it('rotation 0 returns the original shape', () => {
    const r = transformOption(L, 0, false);
    expect(r.bbox).toEqual([2, 2]);
    expect(r.shape.sort()).toEqual([[0, 0], [0, 1], [1, 0]].sort());
  });

  it('rotation 1 (CW 90°) maps top-left to top-right', () => {
    const r = transformOption(L, 1, false);
    expect(r.bbox).toEqual([2, 2]);
    expect(r.shape.sort()).toEqual([[0, 0], [0, 1], [1, 1]].sort());
  });

  it('rotation 2 (180°) inverts both axes', () => {
    const r = transformOption(L, 2, false);
    expect(r.shape.sort()).toEqual([[0, 1], [1, 0], [1, 1]].sort());
  });

  it('rotation 4× returns to identity', () => {
    let s = L.shape.slice();
    for (let i = 0; i < 4; i++) {
      const r = transformOption({ ...L, shape: s }, 1, false);
      s = r.shape;
    }
    expect(s.sort()).toEqual(L.shape.sort());
  });

  it('mirror flips across vertical axis', () => {
    const r = transformOption(L, 0, true);
    expect(r.shape.sort()).toEqual([[0, 0], [0, 1], [1, 1]].sort());
  });
});
