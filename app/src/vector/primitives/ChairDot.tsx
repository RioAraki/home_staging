import type { PrimitiveProps } from '../types';

/**
 * Single-cell chair glyph — a small rounded square centred in each cell,
 * with a back-stroke on one side (the "face" direction is OPPOSITE the
 * back: a chair facing N has its backrest on the S edge).
 *
 * extras:
 *   face ('N'|'S'|'E'|'W', default 'N') — direction the chair faces.
 *   compact (boolean, default false) — render slightly smaller.
 */
export function ChairDot({ cells, cellSize, theme, extras }: PrimitiveProps) {
  const face = (extras.face as 'N' | 'S' | 'E' | 'W') ?? 'N';
  const compact = !!extras.compact;
  const sizeFactor = compact ? 0.46 : 0.56;
  const size = cellSize * sizeFactor;
  const radius = size * 0.20;
  const backInset = size * 0.18;

  return (
    <g className="primitive chair-dot">
      {cells.map(([r, c], i) => {
        const cx = c * cellSize + cellSize / 2;
        const cy = r * cellSize + cellSize / 2;
        const x = cx - size / 2;
        const y = cy - size / 2;
        // Backrest stroke runs along the side OPPOSITE the face direction.
        let bx1 = x, by1 = y, bx2 = x + size, by2 = y;   // default = top (chair faces S)
        if (face === 'N') { by1 = y + size; by2 = y + size; }       // back on bottom
        else if (face === 'S') { by1 = y; by2 = y; }                // back on top
        else if (face === 'E') { bx1 = x; bx2 = x; by1 = y; by2 = y + size; } // back on left
        else if (face === 'W') { bx1 = x + size; bx2 = x + size; by1 = y; by2 = y + size; }
        // Pull the back-stroke slightly inside for a "padded" look.
        const inset = backInset;
        if (face === 'N') { by1 -= inset; by2 -= inset; }
        else if (face === 'S') { by1 += inset; by2 += inset; }
        else if (face === 'E') { bx1 += inset; bx2 += inset; }
        else if (face === 'W') { bx1 -= inset; bx2 -= inset; }
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={size} height={size}
              rx={radius} ry={radius}
              fill={theme.fill === 'none' ? 'rgba(255,255,255,0.04)' : theme.fill}
              stroke={theme.stroke}
              strokeWidth={theme.strokeWidth * 0.85}
            />
            <line
              x1={bx1} y1={by1} x2={bx2} y2={by2}
              stroke={theme.stroke}
              strokeWidth={theme.strokeWidth * 1.2}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
}
