// Vector furniture rendering — shared types.

export type Cell = [number, number];   // [row, col]

/**
 * A theme = a bag of colour + line-weight tokens consumed by every primitive.
 * Adding a theme = adding a new instance of this type; primitives don't change.
 */
export interface ThemeTokens {
  id: string;
  label: string;
  /** Backdrop colour. Used by previews; the actual game bg is set elsewhere. */
  bg: string;
  /** Main outline / stroke colour. */
  stroke: string;
  /** Filled shape colour (e.g. body of a sink). `'none'` = no fill. */
  fill: string;
  /** Accent colour for highlights (faucets, knobs, icons). */
  accent: string;
  /** Default stroke width (in svg user units = pixels at 1x). */
  strokeWidth: number;
  /** Secondary stroke for inner details (grates, stripes). */
  detailStroke: string;
  detailStrokeWidth: number;
}

/**
 * One visual element placed somewhere on the furniture's cell grid. The
 * `kind` field selects which primitive component renders it; `cells` lists
 * which cells (within the option's bbox) the primitive covers. Extra fields
 * are kind-specific and forwarded to the component as `extras`.
 */
export interface VisualPart {
  kind: string;
  cells: Cell[];
  [extra: string]: unknown;
}

export interface FurnitureVisual {
  number: number;
  variant: 'A' | 'B';
  option_index: number;
  parts: VisualPart[];
}

export interface FurnitureVisualData {
  entries: FurnitureVisual[];
}

/** Props every primitive component receives. */
export interface PrimitiveProps {
  cells: Cell[];
  cellSize: number;
  theme: ThemeTokens;
  /** Free-form per-primitive extras pulled from the visual schema. */
  extras: Record<string, unknown>;
}
