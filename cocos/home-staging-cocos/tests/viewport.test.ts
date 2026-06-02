import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeLayout, setLayout, layout, edgeX, edgeY, hitTestLocal,
  MAP_CROP_MARGIN, FULL_GRID_ROWS, FULL_GRID_COLS,
} from '../assets/scripts/ui/viewport';
import type { Scenario } from '../assets/scripts/core/types';

/** Build a 16x16 scenario with an indoor block at rows [r0..r1], cols [c0..c1]. */
function scenarioWithIndoor(rMin: number, rMax: number, cMin: number, cMax: number): Scenario {
  const rows: string[] = [];
  for (let r = 0; r < FULL_GRID_ROWS; r++) {
    let line = '';
    for (let c = 0; c < FULL_GRID_COLS; c++) {
      const inside = r >= rMin && r <= rMax && c >= cMin && c <= cMax;
      line += inside ? 'I' : '.';
    }
    rows.push(line);
  }
  return {
    grid: {
      ascii: rows.join('\n') + '\n',
      legend: { '.': { terrain: 'outdoor' }, 'I': { terrain: 'indoor' } },
    },
  } as unknown as Scenario;
}

describe('computeLayout', () => {
  it('crops to indoor bbox + margin and fits the cell size', () => {
    // 6x6 indoor block, rows 4..9, cols 5..10
    const sc = scenarioWithIndoor(4, 9, 5, 10);
    const l = computeLayout(sc, 1000, 1000);
    expect(MAP_CROP_MARGIN).toBe(1);
    expect(l.r0).toBe(3);          // 4 - 1
    expect(l.c0).toBe(4);          // 5 - 1
    expect(l.rows).toBe(8);        // (9+1) - (4-1) + 1
    expect(l.cols).toBe(8);        // (10+1) - (5-1) + 1
    expect(l.cell).toBe(118);      // floor(min((1000-56)/8, (1000-56)/8))
    expect(l.w).toBe(944);
    expect(l.h).toBe(944);
  });

  it('clamps the crop window to the 16x16 grid', () => {
    const sc = scenarioWithIndoor(0, 15, 0, 15); // indoor everywhere
    const l = computeLayout(sc, 800, 800);
    expect(l.r0).toBe(0);
    expect(l.c0).toBe(0);
    expect(l.rows).toBe(16);
    expect(l.cols).toBe(16);
  });

  it('picks the limiting dimension for cell size', () => {
    const sc = scenarioWithIndoor(4, 9, 5, 10); // 8x8 crop after margin
    const l = computeLayout(sc, 500, 1000);     // width-limited
    expect(l.cell).toBe(55);                    // floor((500-56)/8)
  });

  it('falls back to the full grid when there are no indoor cells', () => {
    const sc = scenarioWithIndoor(-1, -1, -1, -1); // no 'I' at all
    const l = computeLayout(sc, 800, 800);
    expect(l.rows).toBe(16);
    expect(l.cols).toBe(16);
  });
});

describe('edge helpers + hitTestLocal', () => {
  beforeEach(() => {
    setLayout(computeLayout(scenarioWithIndoor(4, 9, 5, 10), 1000, 1000));
  });

  it('edgeX/edgeY map the crop corners to the centred pixel box', () => {
    const { r0, c0, rows, cols, w, h } = layout();
    expect(edgeX(c0)).toBe(-w / 2);
    expect(edgeX(c0 + cols)).toBe(w / 2);
    expect(edgeY(r0)).toBe(h / 2);
    expect(edgeY(r0 + rows)).toBe(-h / 2);
  });

  it('round-trips a cell centre back to its absolute grid coords', () => {
    const cell = layout().cell;
    for (const [r, c] of [[3, 4], [4, 5], [9, 10], [10, 11]] as const) {
      const cx = edgeX(c) + cell / 2;
      const cy = edgeY(r) - cell / 2;
      const hit = hitTestLocal(cx, cy);
      expect(hit).toEqual({ kind: 'cell', row: r, col: c });
    }
  });

  it('detects edges and emits keys in absolute grid coords', () => {
    const cell = layout().cell;
    // A point just below the top edge of cell (4,5): near its top wall.
    const hit = hitTestLocal(edgeX(5) + cell / 2, edgeY(4) - 1);
    expect(hit.kind).toBe('edge');
    if (hit.kind === 'edge') {
      expect(hit.side).toBe('top');
      expect(hit.key).toBe('h:4:5');
      expect(hit.row).toBe(4);
      expect(hit.col).toBe(5);
    }
  });

  it('returns outside for points beyond the cropped map', () => {
    const { w } = layout();
    expect(hitTestLocal(w, 0).kind).toBe('outside');
    expect(hitTestLocal(-w, 0).kind).toBe('outside');
  });
});
