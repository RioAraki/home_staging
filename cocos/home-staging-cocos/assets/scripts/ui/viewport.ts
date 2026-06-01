import type { Scenario } from '../core/types';

/** The underlying scenario grid is always 16x16; only the *view* is cropped. */
export const FULL_GRID_ROWS = 16;
export const FULL_GRID_COLS = 16;

/** Outdoor cells kept around the indoor bbox so the front door + hallway still
 *  have somewhere to go. Single global default; per-scenario override deferred
 *  until a scenario actually needs it. */
export const MAP_CROP_MARGIN = 2;

/** Fraction of a cell, measured from each grid line, that counts as an "edge"
 *  tap (wall/door) rather than a cell tap. Was a fixed 12px at cell=40. */
const EDGE_SLOP_RATIO = 0.3;

/** The active view layout. Coords are in the original 16x16 grid space; the
 *  layout only controls how that space maps onto screen pixels. */
export interface MapLayout {
  cell: number;       // dynamic cell edge length in px
  r0: number; c0: number;   // top-left of crop region (original grid coords)
  rows: number; cols: number;
  w: number; h: number;     // cropped pixel size = cols*cell, rows*cell
}

function makeLayout(cell: number, r0: number, c0: number, rows: number, cols: number): MapLayout {
  return { cell, r0, c0, rows, cols, w: cols * cell, h: rows * cell };
}

let _layout: MapLayout = makeLayout(40, 0, 0, FULL_GRID_ROWS, FULL_GRID_COLS);

export function layout(): MapLayout { return _layout; }
export function setLayout(l: MapLayout): void { _layout = l; }

/**
 * Compute the crop window for a scenario: the indoor bbox padded by
 * MAP_CROP_MARGIN, clamped to the 16x16 grid, with a cell size that makes the
 * whole cropped map fit inside availW x availH.
 */
export function computeLayout(scenario: Scenario, availW: number, availH: number): MapLayout {
  const ascii = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
  const legend = scenario.grid.legend;

  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (let r = 0; r < FULL_GRID_ROWS; r++) {
    for (let c = 0; c < FULL_GRID_COLS; c++) {
      const ch = ascii[r]?.[c] ?? '.';
      if (legend[ch]?.terrain === 'indoor') {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (!isFinite(minR)) {
    console.warn('[viewport] scenario has no indoor cells; using full 16x16 grid');
    minR = 0; minC = 0; maxR = FULL_GRID_ROWS - 1; maxC = FULL_GRID_COLS - 1;
  }

  const r0 = Math.max(0, minR - MAP_CROP_MARGIN);
  const c0 = Math.max(0, minC - MAP_CROP_MARGIN);
  const r1 = Math.min(FULL_GRID_ROWS - 1, maxR + MAP_CROP_MARGIN);
  const c1 = Math.min(FULL_GRID_COLS - 1, maxC + MAP_CROP_MARGIN);

  const rows = r1 - r0 + 1;
  const cols = c1 - c0 + 1;
  const cell = Math.max(1, Math.floor(Math.min(availW / cols, availH / rows)));
  return makeLayout(cell, r0, c0, rows, cols);
}

// ── Grid<->screen helpers (FloorPlan-local coords, origin at centre, y-up) ──

/** Screen x of the vertical grid line at column `c` (left edge of cell c). */
export function edgeX(c: number): number {
  return (c - _layout.c0) * _layout.cell - _layout.w / 2;
}

/** Screen y of the horizontal grid line at row `r` (top edge of cell r). */
export function edgeY(r: number): number {
  return _layout.h / 2 - (r - _layout.r0) * _layout.cell;
}

export type HitResult =
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'edge'; key: string; row: number; col: number; side: 'top' | 'right' | 'bottom' | 'left' }
  | { kind: 'outside' };

/**
 * Hit-test a point in FloorPlan-local coords (origin centre, y-up). Returns a
 * cell, an edge (with its wall/door key in absolute grid coords), or outside.
 */
export function hitTestLocal(localX: number, localY: number): HitResult {
  const { cell, r0, c0, w, h } = _layout;
  const x = localX + w / 2;   // 0..w, left -> right
  const y = h / 2 - localY;   // 0..h, top  -> bottom
  if (x < 0 || y < 0 || x >= w || y >= h) return { kind: 'outside' };

  const cropCol = Math.floor(x / cell);
  const cropRow = Math.floor(y / cell);
  const row = cropRow + r0;   // absolute grid coords
  const col = cropCol + c0;

  const lx = x - cropCol * cell;
  const ly = y - cropRow * cell;
  const distTop = ly, distBottom = cell - ly, distLeft = lx, distRight = cell - lx;
  const minDist = Math.min(distTop, distBottom, distLeft, distRight);
  const slop = cell * EDGE_SLOP_RATIO;

  if (minDist >= slop) return { kind: 'cell', row, col };

  let side: 'top' | 'right' | 'bottom' | 'left';
  if      (minDist === distTop)    side = 'top';
  else if (minDist === distBottom) side = 'bottom';
  else if (minDist === distLeft)   side = 'left';
  else                              side = 'right';

  let key: string;
  if      (side === 'top')    key = `h:${row}:${col}`;
  else if (side === 'bottom') key = `h:${row + 1}:${col}`;
  else if (side === 'left')   key = `v:${row}:${col}`;
  else                         key = `v:${row}:${col + 1}`;
  return { kind: 'edge', key, row, col, side };
}
