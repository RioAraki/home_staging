// Renders one furniture option as composed primitives, from its visual
// schema entry. Falls back to an auto-traced SVG (produced by
// md/trace_cards.py) when no hand-authored schema is present. Returns
// null only when neither source is available so the caller can fall back
// to the raster card crop.

import { getPrimitive } from './primitives';
import { themes, type ThemeId, DEFAULT_THEME_ID } from './themes';
import { visualByKey } from '../data/visual';
import { tracedSvgUrl } from './tracedSvg';

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

  // Hand-authored schema wins — explicit primitives or raw_svg blocks.
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
        {/* Invisible bbox spacer — keeps the <g> size consistent for layout. */}
        <rect x={0} y={0} width={W} height={H} fill="none" />
      </g>
    );
  }

  // Otherwise drop in the auto-traced SVG if one exists. The traced
  // file was rasterised at SCALE_TO units long-edge and preserves the
  // crop's aspect ratio, so stretching it to fit the bbox matches what
  // the raster fallback does (preserveAspectRatio="none").
  const tracedUrl = tracedSvgUrl(number, variant, optionIndex);
  if (tracedUrl) {
    return (
      <g className="furniture-vector furniture-vector-traced">
        <image
          href={tracedUrl}
          x={0} y={0}
          width={W} height={H}
          preserveAspectRatio="none"
        />
      </g>
    );
  }
  return null;
}

/** True when this option has either a hand-authored schema OR an
 *  auto-traced SVG available. */
export function hasVectorVisual(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
): boolean {
  return visualByKey(number, variant, optionIndex) !== null
    || tracedSvgUrl(number, variant, optionIndex) !== null;
}
