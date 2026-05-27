// Renders one furniture option in three possible ways, picked by priority:
//   1. Hand-authored schema in furniture_visual.yaml (programmatic
//      primitives or raw_svg paste).
//   2. Per-shape-cell traced SVGs produced by md/trace_cards.py — we
//      stamp one cell-sized <image> per shape cell. Void cells get
//      nothing and open cells defer to the existing dot layer in
//      FloorPlan / FurnitureShape.
//   3. null — caller falls back to the raster card crop.

import { getPrimitive } from './primitives';
import { themes, type ThemeId, DEFAULT_THEME_ID } from './themes';
import { visualByKey } from '../data/visual';
import { cellTracedSvgUrl, hasAnyCellTrace } from './tracedSvg';
import { cardByNumberVariant } from '../data';

interface Props {
  number: number;
  variant: 'A' | 'B';
  optionIndex: number;
  /** Bbox dimensions [rows, cols] in cells — same as option.bbox. */
  rows: number;
  cols: number;
  cellSize: number;
  themeId?: ThemeId;
}

export function FurnitureVector({
  number, variant, optionIndex, rows, cols, cellSize, themeId = DEFAULT_THEME_ID,
}: Props) {
  const visual = visualByKey(number, variant, optionIndex);
  const W = cols * cellSize;
  const H = rows * cellSize;

  // Hand-authored schema wins.
  if (visual) {
    const theme = themes[themeId] ?? themes[DEFAULT_THEME_ID];
    return (
      <g className="furniture-vector">
        {visual.parts.map((part, i) => {
          const Comp = getPrimitive(part.kind);
          if (!Comp) return null;
          const { kind: _k, cells, ...extras } = part;
          return (
            <Comp
              key={i}
              cells={cells}
              cellSize={cellSize}
              theme={theme}
              extras={extras}
            />
          );
        })}
        <rect x={0} y={0} width={W} height={H} fill="none" />
      </g>
    );
  }

  // Per-cell traced SVGs. Render only the shape cells; open / void are
  // skipped (open gets its dot from the surrounding layer).
  if (hasAnyCellTrace(number, variant, optionIndex)) {
    const card = cardByNumberVariant(number, variant);
    const opt = card?.options.find((o) => o.option_index === optionIndex);
    const shapeCells: Array<[number, number]> = opt?.shape ?? [];
    return (
      <g className="furniture-vector furniture-vector-traced">
        {shapeCells.map(([r, c], i) => {
          const url = cellTracedSvgUrl(number, variant, optionIndex, r, c);
          if (!url) return null;
          return (
            <image
              key={`cell-${i}`}
              href={url}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              preserveAspectRatio="none"
            />
          );
        })}
      </g>
    );
  }

  return null;
}

/** True when this option has either a hand-authored schema OR at least
 *  one per-cell traced SVG available. */
export function hasVectorVisual(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
): boolean {
  return visualByKey(number, variant, optionIndex) !== null
    || hasAnyCellTrace(number, variant, optionIndex);
}
