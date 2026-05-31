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
//
// Carpet (#33) exception: by default, carpets behave like a thin layer
// beneath the floor — other furniture's shape / open cells may overlap with
// carpet shape cells, and a carpet may be placed under existing non-carpet
// furniture. A scenario can opt out by adding a `drawing` rule with
// `id: no_furniture_on_carpet`, in which case carpet cells block placement
// like any other shape (山中诊所 / The Mountain Surgery uses this).

import type { Scenario, CellAttrs } from './types';
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

const CARPET_NUMBER = 33;

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
  nonCarpetShape: Set<string>;  // "r,c" of shape cells from non-carpet pieces
  carpetShape: Set<string>;     // "r,c" of shape cells from carpet pieces (#33)
  openSpaces: Set<string>;      // "r,c" of open-space cells (all pieces)
}

function collectFootprints(placed: PlacedPiece[]): PlacedFootprint {
  const nonCarpetShape = new Set<string>();
  const carpetShape = new Set<string>();
  const openSpaces = new Set<string>();
  for (const p of placed) {
    const card = cardByNumberVariant(p.number, p.variant);
    const opt = card?.options.find((o) => o.option_index === p.optionIndex);
    if (!opt) continue;
    const t = transformOption(opt, p.rotation, p.mirrored);
    const targetShape = p.number === CARPET_NUMBER ? carpetShape : nonCarpetShape;
    for (const [r, c] of absoluteCells(t.shape, p.origin)) targetShape.add(`${r},${c}`);
    for (const [r, c] of absoluteCells(t.open_spaces, p.origin)) openSpaces.add(`${r},${c}`);
  }
  return { nonCarpetShape, carpetShape, openSpaces };
}

function noFurnitureOnCarpet(scenario: Scenario): boolean {
  return (scenario.rules?.drawing ?? []).some((d) => d.id === 'no_furniture_on_carpet');
}

export function validatePlacement(
  scenario: Scenario,
  transformed: TransformedShape,
  origin: Cell,
  alreadyPlaced: PlacedPiece[],
  newPieceNumber: number,
  doors: Record<string, unknown> = {},
  frontDoorEdge: string | null = null,
): ValidationResult {
  const cells = gridCells(scenario);
  const placed = collectFootprints(alreadyPlaced);
  const strict = noFurnitureOnCarpet(scenario);
  const newIsCarpet = newPieceNumber === CARPET_NUMBER;

  // Drawing-rule "must stay walkable" cells — scenarios that declare a
  // rules.drawing entry with a `cells` list (e.g. Game Store's
  // window_area_no_cover row at 14E–14J) treat those cells as forbidden
  // for furniture shape. Open spaces on top of them are fine — they're
  // walkable by definition.
  const noCoverCells = new Set<string>();
  for (const rule of scenario.rules?.drawing ?? []) {
    if (!rule.cells) continue;
    for (const [r, c] of rule.cells) noCoverCells.add(`${r},${c}`);
  }

  // Cells on either side of a door (room door or front door) must stay
  // walkable — a furniture shape on one side would jam the door shut.
  // For a multi-cell-wide front door (e.g. Rehearsal Barn's barn doors)
  // we also protect the extension edge's adjacent cells; otherwise a
  // piece could land in the cells *behind* the door even though those
  // are exactly the squares the rulebook says must stay open.
  const doorAdjacentCells = new Set<string>();
  const collectAdj = (edgeKey: string) => {
    const [type, rStr, cStr] = edgeKey.split(':');
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);
    if (type === 'h') {
      doorAdjacentCells.add(`${r - 1},${c}`);
      doorAdjacentCells.add(`${r},${c}`);
    } else {
      doorAdjacentCells.add(`${r},${c - 1}`);
      doorAdjacentCells.add(`${r},${c}`);
    }
  };
  const isIndoorAt = (r: number, c: number): boolean =>
    isIndoor(cellAttrs(scenario, cells, r, c));
  const isExteriorEdge = (edgeKey: string): boolean => {
    const [type, rStr, cStr] = edgeKey.split(':');
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);
    if (type === 'h') return isIndoorAt(r - 1, c) !== isIndoorAt(r, c);
    return isIndoorAt(r, c - 1) !== isIndoorAt(r, c);
  };
  for (const k of Object.keys(doors)) collectAdj(k);
  if (frontDoorEdge) {
    collectAdj(frontDoorEdge);
    const width = scenario.rules?.front_door?.width ?? 1;
    if (width >= 2) {
      const [t, rStr, cStr] = frontDoorEdge.split(':');
      const fr = parseInt(rStr, 10);
      const fc = parseInt(cStr, 10);
      const forward = t === 'h' ? `h:${fr}:${fc + 1}` : `v:${fr + 1}:${fc}`;
      const backward = t === 'h' ? `h:${fr}:${fc - 1}` : `v:${fr - 1}:${fc}`;
      const extension = isExteriorEdge(forward)
        ? forward
        : isExteriorEdge(backward)
          ? backward
          : null;
      if (extension) collectAdj(extension);
    }
  }

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
    // Non-carpet shape always blocks.
    if (placed.nonCarpetShape.has(key)) {
      // Exception: a NEW carpet being placed UNDER existing non-carpet
      // furniture is allowed in default mode (carpet is a thin layer).
      if (!(newIsCarpet && !strict)) {
        badShape.push([r, c]);
        continue;
      }
    }
    // Open spaces always block shape (cell must stay walkable).
    if (placed.openSpaces.has(key)) {
      // Exception: a NEW carpet under an existing open-space cell is still
      // walkable — carpets are thin layers. This holds in strict mode too,
      // because the "no furniture on carpet" rule only governs shape-on-
      // carpet, not the open / carpet relationship.
      if (!newIsCarpet) {
        badShape.push([r, c]);
        continue;
      }
    }
    // Carpet shape blocks only in strict mode (or carpet-on-carpet always).
    if (placed.carpetShape.has(key)) {
      if (strict || newIsCarpet) {
        badShape.push([r, c]);
        continue;
      }
    }
    // Don't block a door — both cells flanking a door must stay walkable.
    // Carpets are walkable so they're exempt here.
    if (doorAdjacentCells.has(key) && !newIsCarpet) {
      badShape.push([r, c]);
      continue;
    }
    // Scenario "must stay walkable" zones (e.g. window strip).
    if (noCoverCells.has(key) && !newIsCarpet) {
      badShape.push([r, c]);
      continue;
    }
  }
  if (badShape.length) {
    // Build a friendlier message
    const firstBad = badShape[0];
    const attrs = cellAttrs(scenario, cells, firstBad[0], firstBad[1]);
    const key = `${firstBad[0]},${firstBad[1]}`;
    let reason = 'Invalid placement';
    if (!inBounds(firstBad)) reason = 'Furniture goes outside the 16×16 grid';
    else if (!isIndoor(attrs)) reason = 'Furniture must stay inside the building';
    else if (isObstacle(attrs)) reason = 'Cannot cover a predetermined obstacle';
    else if (placed.nonCarpetShape.has(key))
      reason = 'Overlaps another furniture piece';
    else if (placed.carpetShape.has(key))
      reason = newIsCarpet
        ? 'Carpets cannot stack on top of each other'
        : 'This scenario forbids placing furniture on a carpet (地毯上不能放置家具)';
    else if (placed.openSpaces.has(key))
      reason = "Cannot cover another piece's open space";
    else if (doorAdjacentCells.has(key))
      reason = 'Cell flanks a door — both sides of every door must stay walkable';
    else if (noCoverCells.has(key))
      reason = 'Scenario rule forbids covering this cell with furniture (must stay walkable)';
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
    if (placed.nonCarpetShape.has(key)) {
      badOpen.push([r, c]);
      continue;
    }
    // Open-space cells over a carpet are ALWAYS allowed — carpet is
    // walkable, and the scenario-specific "no_furniture_on_carpet" rule
    // only forbids furniture (shape) on carpet, not open-space cells.
    // Open ↔ open overlap is allowed unconditionally (rulebook).
  }
  if (badOpen.length) {
    const firstBad = badOpen[0];
    const attrs = cellAttrs(scenario, cells, firstBad[0], firstBad[1]);
    const key = `${firstBad[0]},${firstBad[1]}`;
    let reason = 'Open-space cell is invalid';
    if (!inBounds(firstBad)) reason = 'Open space extends outside the grid';
    else if (!isIndoor(attrs)) reason = 'Open space must stay inside the building';
    else if (isObstacle(attrs)) reason = 'Open space cannot land on a predetermined obstacle';
    else if (placed.nonCarpetShape.has(key))
      reason = "Open space cannot land on another piece's furniture";
    return { valid: false, reason, badCells: badOpen };
  }

  return { valid: true };
}
