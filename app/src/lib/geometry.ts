// Geometry helpers for furniture pieces on the 16×16 grid.

import type { FurnitureOption, WallEdge, WallEdgeSpec } from '../types';

export type Cell = [number, number];          // [row, col]
export type Rotation = 0 | 1 | 2 | 3;          // 90° CW steps

export interface TransformedShape {
  bbox: [number, number];                       // [rows, cols] after transform
  shape: Cell[];                                // cells the furniture occupies
  open_spaces: Cell[];                          // cells that must stay walkable
  wall_edges: WallEdgeSpec[];                   // exterior edges requiring a wall
  cell_features: Array<[number, number, string]>;  // semantic tags per cell
}

/**
 * Rotate a single cell (r, c) within a bbox of (H, W) by `rot` 90° CW steps.
 * Mirror (along vertical axis) is applied BEFORE rotation if requested.
 */
function rotateCell(r: number, c: number, H: number, W: number, rot: Rotation): Cell {
  switch (rot) {
    case 0: return [r, c];
    case 1: return [c, H - 1 - r];               // CW 90°
    case 2: return [H - 1 - r, W - 1 - c];       // 180°
    case 3: return [W - 1 - c, r];               // CW 270°
  }
}

function rotateWallEdge(edge: WallEdge, rot: Rotation): WallEdge {
  const order: WallEdge[] = ['top', 'right', 'bottom', 'left'];
  const idx = order.indexOf(edge);
  return order[(idx + rot) % 4];
}

function rotateBBox(H: number, W: number, rot: Rotation): [number, number] {
  return rot % 2 === 0 ? [H, W] : [W, H];
}

export function transformOption(
  option: FurnitureOption,
  rotation: Rotation,
  mirrored: boolean,
): TransformedShape {
  const [H, W] = option.bbox;

  const applyMirror = (r: number, c: number): Cell =>
    mirrored ? [r, W - 1 - c] : [r, c];

  const [H2, W2] = rotateBBox(H, W, rotation);

  const transformCell = (r: number, c: number): Cell => {
    const [rm, cm] = applyMirror(r, c);
    return rotateCell(rm, cm, H, W, rotation);
  };

  return {
    bbox: [H2, W2],
    shape: option.shape.map(([r, c]) => transformCell(r, c)),
    open_spaces: option.open_spaces.map(([r, c]) => transformCell(r, c)),
    cell_features: (option.cell_features ?? []).map((entry): [number, number, string] => {
      const [r, c, type] = entry;
      const [rm, cm] = applyMirror(r, c);
      const [rr, cc] = rotateCell(rm, cm, H, W, rotation);
      return [rr, cc, type];
    }),
    wall_edges: (option.wall_edges ?? []).map((entry): WallEdgeSpec => {
      const mirrorSide = (s: WallEdge): WallEdge =>
        mirrored && (s === 'left' || s === 'right')
          ? s === 'left' ? 'right' : 'left'
          : s;
      if (typeof entry === 'string') {
        return rotateWallEdge(mirrorSide(entry), rotation);
      }
      // Per-cell tuple: mirror + rotate BOTH the cell and the side.
      const [r, c, side] = entry;
      const [rm, cm] = applyMirror(r, c);
      const [rr, cc] = rotateCell(rm, cm, H, W, rotation);
      return [rr, cc, rotateWallEdge(mirrorSide(side), rotation)];
    }),
  };
}

/** Convert a transformed shape's local cells to absolute grid cells given an origin. */
export function absoluteCells(localCells: Cell[], origin: Cell): Cell[] {
  const [or, oc] = origin;
  return localCells.map(([r, c]) => [r + or, c + oc] as Cell);
}

/** Check whether a cell is inside the 16×16 grid. */
export function inBounds([r, c]: Cell, rows = 16, cols = 16): boolean {
  return r >= 0 && c >= 0 && r < rows && c < cols;
}
