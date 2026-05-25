// Renders one furniture option as composed primitives, from its visual
// schema entry. Returns null if no schema exists (so the caller can fall
// back to the raster image).

import { getPrimitive } from './primitives';
import { themes, type ThemeId, DEFAULT_THEME_ID } from './themes';
import { visualByKey } from '../data/visual';

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
  if (!visual) return null;
  const theme = themes[themeId] ?? themes[DEFAULT_THEME_ID];
  const W = cols * cellSize;
  const H = rows * cellSize;

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
      {/* Invisible bbox spacer — keeps the <g> size consistent for layout. */}
      <rect x={0} y={0} width={W} height={H} fill="none" />
    </g>
  );
}

/** True when this option has a vector schema available. */
export function hasVectorVisual(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
): boolean {
  return visualByKey(number, variant, optionIndex) !== null;
}
