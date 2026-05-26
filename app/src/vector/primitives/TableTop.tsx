import type { PrimitiveProps } from '../types';

/**
 * Table rendered as one box spanning all `cells`, with four leg dots in
 * the corners of the outer cells. The legs are drawn with the accent
 * colour so the piece reads as "wooden furniture" against the lighter
 * stroke colour used elsewhere.
 *
 * extras:
 *   shape ('round'|'rect', default 'rect')
 */
export function TableTop({ cells, cellSize, theme, extras }: PrimitiveProps) {
  if (cells.length === 0) return null;
  const shape = (extras.shape as 'round' | 'rect') ?? 'rect';
  const rs = cells.map((c) => c[0]);
  const cs = cells.map((c) => c[1]);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  const r1 = Math.max(...rs);
  const c1 = Math.max(...cs);
  const pad = cellSize * 0.18;
  const x = c0 * cellSize + pad;
  const y = r0 * cellSize + pad;
  const w = (c1 - c0 + 1) * cellSize - 2 * pad;
  const h = (r1 - r0 + 1) * cellSize - 2 * pad;
  const legR = cellSize * 0.045;
  const legInset = cellSize * 0.07;

  return (
    <g className="primitive table-top">
      {shape === 'round' ? (
        <ellipse
          cx={x + w / 2} cy={y + h / 2}
          rx={w / 2} ry={h / 2}
          fill={theme.fill === 'none' ? 'rgba(255,255,255,0.07)' : theme.fill}
          stroke={theme.stroke}
          strokeWidth={theme.strokeWidth}
        />
      ) : (
        <rect
          x={x} y={y} width={w} height={h}
          rx={cellSize * 0.08}
          ry={cellSize * 0.08}
          fill={theme.fill === 'none' ? 'rgba(255,255,255,0.07)' : theme.fill}
          stroke={theme.stroke}
          strokeWidth={theme.strokeWidth}
        />
      )}
      {/* Leg dots at the four corners (inset slightly). */}
      {[
        [x + legInset, y + legInset],
        [x + w - legInset, y + legInset],
        [x + legInset, y + h - legInset],
        [x + w - legInset, y + h - legInset],
      ].map(([lx, ly], i) => (
        <circle key={i} cx={lx} cy={ly} r={legR} fill={theme.accent} />
      ))}
    </g>
  );
}
