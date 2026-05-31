import type { FurnitureOption } from '../types';
import type { Rotation, Variant } from '../store/game';
import { transformOption } from '../lib/geometry';
import { optionImageUrl } from '../lib/optionImage';
import { FurnitureVector, hasSchemaVisual } from '../vector/FurnitureVector';
import './FurnitureShape.css';

interface FurnitureShapeProps {
  option: FurnitureOption;          // RAW (un-transformed) option from data
  number: number;
  variant: Variant;
  cellSize?: number;
  rotation?: Rotation;              // default 0
  mirrored?: boolean;               // default false
  showName?: boolean;
}

/**
 * Renders one furniture option using the card artwork as the visual base,
 * with semantic overlays drawn on top:
 *   - open spaces : light diagonal hatch (must stay walkable)
 *   - wall_edges  : thick white stroke on the relevant side(s)
 * Rotation/mirror are applied to both the artwork image and the overlays so
 * Card thumbnails and SelectionStatus previews stay in sync with what
 * FloorPlan renders.
 */
export function FurnitureShape({
  option,
  number,
  variant,
  cellSize = 18,
  rotation = 0,
  mirrored = false,
  showName = false,
}: FurnitureShapeProps) {
  const t = transformOption(option, rotation, mirrored);
  const [rows, cols] = t.bbox;
  const w = cols * cellSize;
  const h = rows * cellSize;

  // Image is sized to the ORIGINAL bbox and rotated/mirrored into the
  // transformed bbox via SVG transform around the center.
  const [origRows, origCols] = option.bbox;
  const origPxW = origCols * cellSize;
  const origPxH = origRows * cellSize;
  const imageUrl = optionImageUrl(number, variant, option.option_index);

  // Map each wall_edges entry to a list of (cellRow, cellCol, side) the
  // bold stroke should cover on the card preview. String entries fan out to
  // every non-void cell on that bbox side; tuple entries are taken verbatim.
  const wallStrokes: Array<{ r: number; c: number; side: 'top' | 'right' | 'bottom' | 'left' }> = (() => {
    const out: Array<{ r: number; c: number; side: 'top' | 'right' | 'bottom' | 'left' }> = [];
    const nonVoid = [...t.shape, ...t.open_spaces];
    const [tH, tW] = t.bbox;
    for (const entry of t.wall_edges) {
      if (typeof entry === 'string') {
        const side = entry;
        for (const [r, c] of nonVoid) {
          if (
            (side === 'top' && r === 0) ||
            (side === 'bottom' && r === tH - 1) ||
            (side === 'left' && c === 0) ||
            (side === 'right' && c === tW - 1)
          ) {
            out.push({ r, c, side });
          }
        }
      } else {
        const [r, c, side] = entry;
        out.push({ r, c, side });
      }
    }
    return out;
  })();

  // Clip mask = SHAPE cells only. Open-space cells render just the centre
  // dot (the scanned crop's borders are imprecise around them).
  const visibleCells: Array<[number, number]> = option.shape.map(
    ([r, c]) => [r, c],
  );
  const clipId = `vis-clip-${number}-${variant}-${option.option_index}`;

  return (
    <div className="furniture-shape">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shape-svg">
        <defs>
          <clipPath id={clipId}>
            {visibleCells.map(([r, c], i) => (
              <rect
                key={i}
                x={-origPxW / 2 + c * cellSize}
                y={-origPxH / 2 + r * cellSize}
                width={cellSize}
                height={cellSize}
              />
            ))}
          </clipPath>
        </defs>

        {/* Artwork base — vector primitives from furniture_visual.yaml when
            available, otherwise the raster card crop (invert + lighten in
            CSS so dark sketch lines show as bright on the blueprint
            backdrop). Both are clipped to shape so void bbox cells stay
            transparent.

            Sharing this branch with FloorPlan means tagging an option in
            the visual schema automatically updates the review thumbnail
            and any sidebar / status preview, so the review pass actually
            shows the new render. */}
        {hasSchemaVisual(number, variant, option.option_index) ? (
          <g
            transform={`translate(${w / 2}, ${h / 2}) rotate(${rotation * 90}) scale(${mirrored ? -1 : 1}, 1)`}
            className="piece-vector"
          >
            <g transform={`translate(${-origPxW / 2}, ${-origPxH / 2})`}>
              <FurnitureVector
                number={number}
                variant={variant}
                optionIndex={option.option_index}
                rows={origRows}
                cols={origCols}
                cellSize={cellSize}
              />
            </g>
          </g>
        ) : (
          <g
            transform={`translate(${w / 2}, ${h / 2}) rotate(${rotation * 90}) scale(${mirrored ? -1 : 1}, 1)`}
            className="piece-art"
          >
            <image
              href={imageUrl}
              x={-origPxW / 2}
              y={-origPxH / 2}
              width={origPxW}
              height={origPxH}
              preserveAspectRatio="none"
              clipPath={`url(#${clipId})`}
            />
          </g>
        )}

        {/* Open-space marker — a single dot at the cell centre. */}
        {t.open_spaces.map(([r, c], i) => (
          <circle
            key={`o${i}`}
            cx={c * cellSize + cellSize / 2}
            cy={r * cellSize + cellSize / 2}
            r={Math.max(1.5, cellSize * 0.09)}
            className="open-space-dot"
          />
        ))}

        {/* Wall edges — bold amber stroke along each (cell, side) the option's
            printed card shows as a bold border. Inset by half the stroke
            width so the line stays inside the SVG viewBox (a stroke
            centered on the boundary would lose half its width to clipping).
            Amber + thick so wall mistakes jump out in the review UI. */}
        {wallStrokes.map(({ r, c, side }, i) => {
          const sw = Math.max(3, cellSize * 0.12);
          const inset = sw / 2;
          const x = c * cellSize;
          const y = r * cellSize;
          const common = { stroke: 'var(--accent, #ffe169)', strokeWidth: sw, strokeLinecap: 'round' as const };
          if (side === 'top')
            return <line key={`w${i}`} x1={x} y1={y + inset} x2={x + cellSize} y2={y + inset} {...common} />;
          if (side === 'bottom')
            return <line key={`w${i}`} x1={x} y1={y + cellSize - inset} x2={x + cellSize} y2={y + cellSize - inset} {...common} />;
          if (side === 'left')
            return <line key={`w${i}`} x1={x + inset} y1={y} x2={x + inset} y2={y + cellSize} {...common} />;
          return <line key={`w${i}`} x1={x + cellSize - inset} y1={y} x2={x + cellSize - inset} y2={y + cellSize} {...common} />;
        })}
      </svg>
      {showName && <div className="shape-name">{option.name_zh}</div>}
    </div>
  );
}
