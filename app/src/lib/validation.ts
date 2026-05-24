// Placement validation for a furniture option at a candidate origin.
//
// Per the rulebook (md/RULES.md):
//   - Each piece has SHAPE cells (the furniture itself) and OPEN-SPACE cells
//     (squares that must remain walkable).
//   - SHAPE cells cannot land on:
//       · cells outside the 16×16 grid
//       · cells that are not indoor terrain
//       · cells already occupied by another piece's shape
//       · cells already occupied by another piece's open space
//         (open spaces must stay empty — a piece of furniture covering an
//          open space violates that rule)
//       · cells holding a pre-drawn obstacle (tree, column, water, …) — not
//         relevant for the training scenario but checked generically here.
//   - OPEN-SPACE cells cannot land on:
//       · cells outside the grid or non-indoor terrain
//       · another piece's SHAPE cell (the open space requires walkability,
//         and a shape cell is occupied / not walkable)
//       · pre-drawn obstacles
//   - OPEN-SPACE ↔ OPEN-SPACE overlap IS allowed (explicit rule).

import type { Scenario, CellAttrs } from '../types';
import type { Cell, TransformedShape } from './geometry';
import { absoluteCells, inBounds } from './geometry';
import type { PlacedPiece } from '../store/game';
import { transformOption } from './geometry';
import { cardByNumberVariant } from '../data';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  badCells?: Cell[];
}

function gridCells(scenario: Scenario): string[][] {
  return scenario.grid.ascii.replace(/\n+$/, '').split('\n').map((r) => r.split(''));
}

function cellAttrs(scenario: Scenario, cells: string[][], r: number, c: number): CellAttrs | null {
  if (!inBounds([r, c])) return null;
  const ch = cells[r]?.[c];
  if (!ch) return null;
  return scenario.grid.legend[ch] ?? null;
}

function isIndoor(attrs: CellAttrs | null): boolean {
  return attrs?.terrain === 'indoor';
}

function isObstacle(attrs: CellAttrs | null): boolean {
  // Predetermined non-buildable features inside (or outside) the building.
  // Trees, columns, water, etc. — anything with a feature key beyond plain indoor.
  if (!attrs) return false;
  if (attrs.terrain === 'water' || attrs.terrain === 'obstacle') return true;
  const f = attrs.feature;
  if (!f) return false;
  // Some features are markers we DO allow furniture on (e.g. door_target on
  // an exterior wall edge — but those live in pre_drawn, not the grid).
  const blockers = new Set([
    'tree',
    'column',
    'wall_pillar',
    'lake',
    'low_ceiling',
    'charred',
  ]);
  return blockers.has(f);
}

interface PlacedFootprint {
  shape: Set<string>;        // "r,c" of occupied cells from placed pieces
  openSpaces: Set<string>;   // "r,c" of open-space cells from placed pieces
}

function collectFootprints(placed: PlacedPiece[]): PlacedFootprint {
  const shape = new Set<string>();
  const openSpaces = new Set<string>();
  for (const p of placed) {
    const card = cardByNumberVariant(p.number, p.variant);
    const opt = card?.options.find((o) => o.option_index === p.optionIndex);
    if (!opt) continue;
    const t = transformOption(opt, p.rotation, p.mirrored);
    for (const [r, c] of absoluteCells(t.shape, p.origin)) shape.add(`${r},${c}`);
    for (const [r, c] of absoluteCells(t.open_spaces, p.origin)) openSpaces.add(`${r},${c}`);
  }
  return { shape, openSpaces };
}

export function validatePlacement(
  scenario: Scenario,
  transformed: TransformedShape,
  origin: Cell,
  alreadyPlaced: PlacedPiece[],
): ValidationResult {
  const cells = gridCells(scenario);
  const placed = collectFootprints(alreadyPlaced);

  const absShape = absoluteCells(transformed.shape, origin);
  const absOpen = absoluteCells(transformed.open_spaces, origin);

  // 1) Shape cells: in bounds, indoor, no obstacle, no overlap with prior shape/open
  const badShape: Cell[] = [];
  for (const [r, c] of absShape) {
    const attrs = cellAttrs(scenario, cells, r, c);
    if (!inBounds([r, c]) || !isIndoor(attrs) || isObstacle(attrs)) {
      badShape.push([r, c]);
      continue;
    }
    const key = `${r},${c}`;
    if (placed.shape.has(key) || placed.openSpaces.has(key)) {
      badShape.push([r, c]);
    }
  }
  if (badShape.length) {
    // Build a friendlier message
    const firstBad = badShape[0];
    const attrs = cellAttrs(scenario, cells, firstBad[0], firstBad[1]);
    let reason = 'Invalid placement';
    if (!inBounds(firstBad)) reason = 'Furniture goes outside the 16×16 grid';
    else if (!isIndoor(attrs)) reason = 'Furniture must stay inside the building';
    else if (isObstacle(attrs)) reason = 'Cannot cover a predetermined obstacle';
    else if (placed.shape.has(`${firstBad[0]},${firstBad[1]}`))
      reason = 'Overlaps another furniture piece';
    else if (placed.openSpaces.has(`${firstBad[0]},${firstBad[1]}`))
      reason = 'Cannot cover another piece\'s open space';
    return { valid: false, reason, badCells: badShape };
  }

  // 2) Open-space cells: in bounds, indoor, no obstacle, not on another piece's shape
  const badOpen: Cell[] = [];
  for (const [r, c] of absOpen) {
    const attrs = cellAttrs(scenario, cells, r, c);
    if (!inBounds([r, c]) || !isIndoor(attrs) || isObstacle(attrs)) {
      badOpen.push([r, c]);
      continue;
    }
    const key = `${r},${c}`;
    if (placed.shape.has(key)) {
      badOpen.push([r, c]);
    }
    // Note: open ↔ open overlap is allowed (rulebook).
  }
  if (badOpen.length) {
    const firstBad = badOpen[0];
    const attrs = cellAttrs(scenario, cells, firstBad[0], firstBad[1]);
    let reason = 'Open-space cell is invalid';
    if (!inBounds(firstBad)) reason = 'Open space extends outside the grid';
    else if (!isIndoor(attrs)) reason = 'Open space must stay inside the building';
    else if (isObstacle(attrs)) reason = 'Open space cannot land on a predetermined obstacle';
    else if (placed.shape.has(`${firstBad[0]},${firstBad[1]}`))
      reason = 'Open space cannot land on another piece\'s furniture';
    return { valid: false, reason, badCells: badOpen };
  }

  return { valid: true };
}
