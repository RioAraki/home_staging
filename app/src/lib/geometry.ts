// Geometry helpers for furniture pieces on the 16×16 grid.

import type { FurnitureOption, WallEdge } from '../types';

export type Cell = [number, number];          // [row, col]
export type Rotation = 0 | 1 | 2 | 3;          // 90° CW steps

export interface TransformedShape {
  bbox: [number, number];                       // [rows, cols] after transform
  shape: Cell[];                                // cells the furniture occupies
  open_spaces: Cell[];                          // cells that must stay walkable
  wall_edges: WallEdge[];                       // exterior edges requiring a wall
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
    wall_edges: (option.wall_edges ?? []).map((e) => {
      // Mirror swaps left/right
      let edge: WallEdge = e;
      if (mirrored && (edge === 'left' || edge === 'right')) {
        edge = edge === 'left' ? 'right' : 'left';
      }
      return rotateWallEdge(edge, rotation);
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
