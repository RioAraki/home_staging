// Shared helpers for resolving a placed/selected piece back to its card
// option and computing its world-grid cells. Every consumer used to inline
// the same "card → option → transformOption → absoluteCells" chain (and the
// store had six hand-copied rotation loops) — keep the transform path
// single-sourced here.

import { cardByNumberVariant, furnitureOptionByName } from './dataLoader';
import type { FurnitureOption } from './types';
import {
  transformOption, absoluteCells,
  type TransformedShape, type Cell, type Rotation,
} from './geometry';

/** The carpet (#33) — the only furniture you may walk on. It occupies no
 *  squares at scoring and scores no points itself (RULES.zh.md §画家具). */
export const CARPET_NUMBER = 33;

/** The minimal fields needed to resolve a piece's transformed option.
 *  Both SelectedOption and PlacedPiece satisfy this.
 *
 *  Named furniture: when `name` is set, the option is resolved from the unified
 *  library by name. Card-derived named furniture ALSO sets number/variant/
 *  optionIndex (so carpet checks and number-based bonuses still apply);
 *  custom furniture sets `source:'custom'` and a placeholder number (0). */
export interface PieceRef {
  number: number;
  variant: 'A' | 'B';
  optionIndex: number;
  rotation: Rotation;
  mirrored: boolean;
  name?: string;                  // unified-library key (named furniture)
  source?: 'card' | 'custom';
}

export type PlacedRef = PieceRef & { origin: [number, number] };

/** The card option this piece refers to, or null if the data is missing. */
export function resolveOption(p: PieceRef): FurnitureOption | null {
  if (p.name) return furnitureOptionByName(p.name);
  const card = cardByNumberVariant(p.number, p.variant);
  return card?.options.find((o) => o.option_index === p.optionIndex) ?? null;
}

/** The piece's option with rotation + mirror applied (bbox-local cells). */
export function resolveTransformed(p: PieceRef): TransformedShape | null {
  const opt = resolveOption(p);
  return opt ? transformOption(opt, p.rotation, p.mirrored) : null;
}

/** World cells occupied by the piece's furniture (shape cells). */
export function pieceShapeCells(p: PlacedRef): Cell[] {
  const t = resolveTransformed(p);
  return t ? absoluteCells(t.shape, p.origin) : [];
}

/** World cells of the piece's open spaces (must stay walkable). */
export function pieceOpenSpaceCells(p: PlacedRef): Cell[] {
  const t = resolveTransformed(p);
  return t ? absoluteCells(t.open_spaces, p.origin) : [];
}

/** Shape ∪ open-space world cells — the full card footprint. Distance-style
 *  rules treat this as the piece's extent. */
export function pieceFootprintCells(p: PlacedRef): Cell[] {
  const t = resolveTransformed(p);
  if (!t) return [];
  return [
    ...absoluteCells(t.shape, p.origin),
    ...absoluteCells(t.open_spaces, p.origin),
  ];
}

/** World cells of cell_features matching `featureType` (e.g. 'plant'). */
export function pieceFeatureCells(p: PlacedRef, featureType: string): Cell[] {
  const t = resolveTransformed(p);
  if (!t) return [];
  const [or, oc] = p.origin;
  return t.cell_features
    .filter(([, , type]) => type === featureType)
    .map(([r, c]) => [r + or, c + oc] as Cell);
}
