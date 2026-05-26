import type { PrimitiveProps } from '../types';

/**
 * Sofa rendered to mimic the printed top-down view: a sofa-body outline
 * with a narrow BACKREST band on the wall side and per-seat trapezoidal
 * cushions whose front edge bulges out in a shallow curve (the cushion
 * "lip" you'd see from above).
 *
 * Visual layers (back-to-front, blueprint theme on dark navy bg):
 *   1. Sofa body fill — a faintly lighter rect than the bg, hinting the
 *      sofa's footprint.
 *   2. Backrest band — a darker fill along the back side that reads as
 *      "the wall-side bar of the sofa".
 *   3. Per-cell cushion shapes — light-fill paths with the curved front
 *      edge, stroked white. Gaps between adjacent cushions become the
 *      seat seams visible on the printed card.
 *   4. Outer outline — a thick white stroke around the whole sofa body.
 *
 * extras:
 *   backDirection ('N'|'S'|'E'|'W') — wall side. Auto-inferred from the
 *     cells' layout when omitted (N for horizontal rows, W for vertical
 *     columns).
 */
export function SofaRun({ cells, cellSize, theme, extras }: PrimitiveProps) {
  if (cells.length === 0) return null;

  // Group cells by row (for horizontal) / col (for vertical) and detect
  // whether the whole run sits in a single row OR column. L-shape sofas
  // (#1B opt2 etc.) fail this test — for those we fall back to per-cell
  // rendering using each cell's row to derive its band direction.
  const rs = cells.map((c) => c[0]);
  const cs = cells.map((c) => c[1]);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  const r1 = Math.max(...rs);
  const c1 = Math.max(...cs);
  const isHorizontal = r0 === r1;
  const isVertical = c0 === c1;
  const back: 'N' | 'S' | 'E' | 'W' = (extras.backDirection as 'N' | 'S' | 'E' | 'W' | undefined)
    ?? (isHorizontal ? 'N' : 'W');

  // Geometry constants tuned to match the printed-card look.
  const bandFrac = 0.20;          // backrest band depth (fraction of cell short axis)
  const cushionInsetSide = 0.10;  // cushion side padding (fraction of cellSize)
  const cushionInsetFront = 0.04; // cushion front inset before the bulge
  const bulgeFrac = 0.10;         // cushion-front curve depth

  // Theme colours.
  const bodyFill = theme.fill === 'none' ? 'rgba(255,255,255,0.05)' : theme.fill;
  const bandFill = 'rgba(0, 0, 0, 0.22)';
  const cushionFill = 'rgba(255,255,255,0.18)';
  const outlineStroke = theme.stroke;
  const outlineWidth = theme.strokeWidth * 1.15;
  const seamStroke = theme.stroke;
  const seamWidth = theme.strokeWidth * 0.85;

  // Helper — build the cushion path for one cell, given that cell's
  // back-direction (the side of the cell that's against the wall).
  const cushionPath = (r: number, c: number, backDir: 'N' | 'S' | 'E' | 'W'): string => {
    const cellX = c * cellSize;
    const cellY = r * cellSize;
    const bandPx = cellSize * bandFrac;
    const sidePad = cellSize * cushionInsetSide;
    const frontInset = cellSize * cushionInsetFront;
    const bulge = cellSize * bulgeFrac;

    if (backDir === 'N') {
      // Back at top: cushion sits below, bulges DOWN.
      const top = cellY + bandPx;
      const bot = cellY + cellSize - frontInset;
      const left = cellX + sidePad;
      const right = cellX + cellSize - sidePad;
      return `M ${left} ${top} L ${right} ${top} L ${right} ${bot} ` +
        `Q ${(left + right) / 2} ${bot + bulge} ${left} ${bot} Z`;
    }
    if (backDir === 'S') {
      const top = cellY + frontInset;
      const bot = cellY + cellSize - bandPx;
      const left = cellX + sidePad;
      const right = cellX + cellSize - sidePad;
      return `M ${left} ${bot} L ${right} ${bot} L ${right} ${top} ` +
        `Q ${(left + right) / 2} ${top - bulge} ${left} ${top} Z`;
    }
    if (backDir === 'W') {
      const left = cellX + bandPx;
      const right = cellX + cellSize - frontInset;
      const top = cellY + sidePad;
      const bot = cellY + cellSize - sidePad;
      return `M ${left} ${top} L ${left} ${bot} L ${right} ${bot} ` +
        `Q ${right + bulge} ${(top + bot) / 2} ${right} ${top} Z`;
    }
    // E
    const left = cellX + frontInset;
    const right = cellX + cellSize - bandPx;
    const top = cellY + sidePad;
    const bot = cellY + cellSize - sidePad;
    return `M ${right} ${top} L ${right} ${bot} L ${left} ${bot} ` +
      `Q ${left - bulge} ${(top + bot) / 2} ${left} ${top} Z`;
  };

  // For row/col runs, paint a single body rect + band rect; otherwise
  // fall back to per-cell rects (gives a stepped outline for L-shapes).
  const bodyRects: React.ReactElement[] = [];
  const bandRects: React.ReactElement[] = [];

  if (isHorizontal || isVertical) {
    const x = c0 * cellSize;
    const y = r0 * cellSize;
    const w = (c1 - c0 + 1) * cellSize;
    const h = (r1 - r0 + 1) * cellSize;
    bodyRects.push(
      <rect key="body" x={x} y={y} width={w} height={h}
        rx={cellSize * 0.10} ry={cellSize * 0.10}
        fill={bodyFill}
        stroke={outlineStroke}
        strokeWidth={outlineWidth}
      />,
    );
    const bandPx = cellSize * bandFrac;
    if (isHorizontal) {
      const by = back === 'N' ? y : y + h - bandPx;
      bandRects.push(<rect key="band" x={x} y={by} width={w} height={bandPx} fill={bandFill} />);
    } else {
      const bx = back === 'W' ? x : x + w - bandPx;
      bandRects.push(<rect key="band" x={bx} y={y} width={bandPx} height={h} fill={bandFill} />);
    }
  } else {
    // L-shape / irregular — render each cell as its own block.
    cells.forEach(([r, c], i) => {
      bodyRects.push(
        <rect key={`body${i}`}
          x={c * cellSize} y={r * cellSize}
          width={cellSize} height={cellSize}
          fill={bodyFill}
          stroke={outlineStroke}
          strokeWidth={outlineWidth}
        />,
      );
    });
  }

  return (
    <g className="primitive sofa-run">
      {bodyRects}
      {bandRects}
      {/* Per-cell cushions. */}
      {cells.map(([r, c], i) => (
        <path
          key={`cush${i}`}
          d={cushionPath(r, c, back)}
          fill={cushionFill}
          stroke={seamStroke}
          strokeWidth={seamWidth}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}
