import type { PrimitiveProps } from '../types';

/**
 * Sofa rendered as one rounded rectangle spanning all `cells`. Cells must
 * be axis-aligned along a single row OR column — the bbox of all cells
 * becomes the sofa body. Internal cushion divider strokes are added
 * between cells, perpendicular to the long axis.
 *
 * extras:
 *   armrests (boolean, default true) — slight inset on the end cells
 *     to suggest armrests.
 */
export function SofaRun({ cells, cellSize, theme, extras }: PrimitiveProps) {
  if (cells.length === 0) return null;
  const armrests = extras.armrests !== false;
  const rs = cells.map((c) => c[0]);
  const cs = cells.map((c) => c[1]);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  const r1 = Math.max(...rs);
  const c1 = Math.max(...cs);
  const horizontal = r0 === r1;
  const pad = cellSize * 0.10;
  const x = c0 * cellSize + pad;
  const y = r0 * cellSize + pad;
  const w = (c1 - c0 + 1) * cellSize - 2 * pad;
  const h = (r1 - r0 + 1) * cellSize - 2 * pad;
  const radius = cellSize * 0.18;

  // Cushion dividers between adjacent cells.
  const dividers: React.ReactElement[] = [];
  if (horizontal) {
    for (let k = 1; k <= c1 - c0; k++) {
      const dx = c0 * cellSize + k * cellSize;
      dividers.push(
        <line key={`d${k}`}
          x1={dx} y1={y + pad}
          x2={dx} y2={y + h - pad}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
        />,
      );
    }
  } else {
    for (let k = 1; k <= r1 - r0; k++) {
      const dy = r0 * cellSize + k * cellSize;
      dividers.push(
        <line key={`d${k}`}
          x1={x + pad} y1={dy}
          x2={x + w - pad} y2={dy}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
        />,
      );
    }
  }

  // Armrest hint: a small inset line on each end of the long axis.
  const armrestLines: React.ReactElement[] = [];
  if (armrests) {
    const inset = cellSize * 0.18;
    if (horizontal) {
      armrestLines.push(
        <line key="aL"
          x1={x + inset} y1={y + pad}
          x2={x + inset} y2={y + h - pad}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
        />,
        <line key="aR"
          x1={x + w - inset} y1={y + pad}
          x2={x + w - inset} y2={y + h - pad}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
        />,
      );
    } else {
      armrestLines.push(
        <line key="aT"
          x1={x + pad} y1={y + inset}
          x2={x + w - pad} y2={y + inset}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
        />,
        <line key="aB"
          x1={x + pad} y1={y + h - inset}
          x2={x + w - pad} y2={y + h - inset}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
        />,
      );
    }
  }

  return (
    <g className="primitive sofa-run">
      <rect
        x={x} y={y} width={w} height={h}
        rx={radius} ry={radius}
        fill={theme.fill === 'none' ? 'rgba(255,255,255,0.06)' : theme.fill}
        stroke={theme.stroke}
        strokeWidth={theme.strokeWidth}
      />
      {dividers}
      {armrestLines}
    </g>
  );
}
