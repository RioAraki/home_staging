import type { FurnitureOption } from '../types';
import './FurnitureShape.css';

interface FurnitureShapeProps {
  option: FurnitureOption;
  cellSize?: number;
  showName?: boolean;
}

/**
 * Renders one furniture option as a mini SVG sketch:
 *   - shape cells   : white-filled (the actual piece)
 *   - open spaces   : light hatched (must stay walkable)
 *   - wall_edges    : thick edge stroke on the relevant side(s)
 */
export function FurnitureShape({ option, cellSize = 18, showName = false }: FurnitureShapeProps) {
  const [rows, cols] = option.bbox;
  const w = cols * cellSize;
  const h = rows * cellSize;

  const isWall = (edge: 'top' | 'right' | 'bottom' | 'left') =>
    option.wall_edges?.includes(edge);

  return (
    <div className="furniture-shape">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shape-svg">
        <defs>
          <pattern
            id={`hatch-${option.option_index}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Bounding-box grid (faint) */}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * cellSize}
            x2={w}
            y2={i * cellSize}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: cols + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * cellSize}
            y1={0}
            x2={i * cellSize}
            y2={h}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.5"
          />
        ))}

        {/* Open spaces (light hatch) */}
        {option.open_spaces.map(([r, c], i) => (
          <rect
            key={`o${i}`}
            x={c * cellSize}
            y={r * cellSize}
            width={cellSize}
            height={cellSize}
            fill={`url(#hatch-${option.option_index})`}
          />
        ))}

        {/* Furniture cells (white fill) */}
        {option.shape.map(([r, c], i) => (
          <rect
            key={`s${i}`}
            x={c * cellSize + 1}
            y={r * cellSize + 1}
            width={cellSize - 2}
            height={cellSize - 2}
            fill="rgba(255,255,255,0.85)"
            stroke="#fff"
            strokeWidth="1"
          />
        ))}

        {/* Wall edges (thicker outer stroke on the relevant side(s)) */}
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
