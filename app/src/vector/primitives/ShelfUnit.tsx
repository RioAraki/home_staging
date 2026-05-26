import type { PrimitiveProps } from '../types';

/**
 * Shelf rendered as one box spanning all `cells` (axis-aligned along a
 * single row OR column). Internal divider strokes between cells. When
 * `extras.books` is true, render small vertical ticks across the box to
 * suggest books — used for bookshelves vs. plain display shelves.
 *
 * extras:
 *   books (boolean, default false)
 *   thickness (number, 0–1, default 0.50) — depth as fraction of the
 *     SHORT axis. Shelves are thin (deep direction is along the wall).
 */
export function ShelfUnit({ cells, cellSize, theme, extras }: PrimitiveProps) {
  if (cells.length === 0) return null;
  const books = !!extras.books;
  const thickness = Math.max(0.2, Math.min(1, Number(extras.thickness) || 0.5));
  const rs = cells.map((c) => c[0]);
  const cs = cells.map((c) => c[1]);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  const r1 = Math.max(...rs);
  const c1 = Math.max(...cs);
  const horizontal = r0 === r1;

  // The shelf sits centred in its cells; depth = thickness * cellSize.
  const pad = cellSize * 0.10;
  let x = c0 * cellSize + pad;
  let y = r0 * cellSize + pad;
  let w = (c1 - c0 + 1) * cellSize - 2 * pad;
  let h = (r1 - r0 + 1) * cellSize - 2 * pad;

  if (horizontal) {
    const newH = cellSize * thickness;
    y = r0 * cellSize + (cellSize - newH) / 2;
    h = newH;
  } else {
    const newW = cellSize * thickness;
    x = c0 * cellSize + (cellSize - newW) / 2;
    w = newW;
  }

  const dividers: React.ReactElement[] = [];
  if (horizontal) {
    for (let k = 1; k <= c1 - c0; k++) {
      const dx = c0 * cellSize + k * cellSize;
      dividers.push(
        <line key={`d${k}`}
          x1={dx} y1={y}
          x2={dx} y2={y + h}
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
          x1={x} y1={dy}
          x2={x + w} y2={dy}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
        />,
      );
    }
  }

  // Book-spine ticks (small lines across the short axis at regular intervals).
  const spines: React.ReactElement[] = [];
  if (books) {
    const totalLen = horizontal ? w : h;
    const numSpines = Math.max(3, Math.floor(totalLen / (cellSize * 0.18)));
    for (let i = 0; i < numSpines; i++) {
      const t = (i + 0.5) / numSpines;
      if (horizontal) {
        const sx = x + t * w;
        spines.push(
          <line key={`s${i}`}
            x1={sx} y1={y + h * 0.18}
            x2={sx} y2={y + h * 0.82}
            stroke={theme.detailStroke}
            strokeWidth={theme.detailStrokeWidth * 0.8}
          />,
        );
      } else {
        const sy = y + t * h;
        spines.push(
          <line key={`s${i}`}
            x1={x + w * 0.18} y1={sy}
            x2={x + w * 0.82} y2={sy}
            stroke={theme.detailStroke}
            strokeWidth={theme.detailStrokeWidth * 0.8}
          />,
        );
      }
    }
  }

  return (
    <g className="primitive shelf-unit">
      <rect
        x={x} y={y} width={w} height={h}
        rx={cellSize * 0.06}
        ry={cellSize * 0.06}
        fill={theme.fill === 'none' ? 'rgba(255,255,255,0.06)' : theme.fill}
        stroke={theme.stroke}
        strokeWidth={theme.strokeWidth}
      />
      {dividers}
      {spines}
    </g>
  );
}
