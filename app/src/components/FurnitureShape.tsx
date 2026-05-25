import type { FurnitureOption } from '../types';
import type { Rotation, Variant } from '../store/game';
import { transformOption } from '../lib/geometry';
import { optionImageUrl } from '../lib/optionImage';
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

  const isWall = (edge: 'top' | 'right' | 'bottom' | 'left') =>
    t.wall_edges.includes(edge);

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

        {/* Artwork base (invert + lighten in CSS, so dark sketch lines show
            as bright on the blueprint backdrop). Clipped to shape ∪ open so
            void bbox cells stay transparent. */}
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

        {/* Wall edges (thicker outer stroke on relevant side). */}
        {isWall('top') && (
          <line x1="0" y1="0" x2={w} y2="0" stroke="#fff" strokeWidth="3" />
        )}
        {isWall('right') && (
          <line x1={w} y1="0" x2={w} y2={h} stroke="#fff" strokeWidth="3" />
        )}
        {isWall('bottom') && (
          <line x1="0" y1={h} x2={w} y2={h} stroke="#fff" strokeWidth="3" />
        )}
        {isWall('left') && (
          <line x1="0" y1="0" x2="0" y2={h} stroke="#fff" strokeWidth="3" />
        )}
      </svg>
      {showName && <div className="shape-name">{option.name_zh}</div>}
    </div>
  );
}
