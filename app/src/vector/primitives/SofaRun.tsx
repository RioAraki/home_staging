import type { PrimitiveProps } from '../types';

/**
 * Sofa rendered to match the printed card art: an outer rounded rect
 * containing a tall BACKREST band at the back and a SEAT CUSHION band at
 * the front, joined by a row of small curved cushion fronts (one per
 * seat). Cushion dividers run between adjacent seats. Mirrors layout for
 * vertical sofa runs (back along the left wall, cushions to the right).
 *
 * extras:
 *   backDirection ('N'|'S'|'E'|'W', default infers from the cells)
 *     — which side the sofa's back is on. For a row of cells along the
 *     top of the card the back is N (against the wall to the north).
 */
export function SofaRun({ cells, cellSize, theme, extras }: PrimitiveProps) {
  if (cells.length === 0) return null;
  const rs = cells.map((c) => c[0]);
  const cs = cells.map((c) => c[1]);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  const r1 = Math.max(...rs);
  const c1 = Math.max(...cs);
  const horizontal = r0 === r1;
  const back: 'N' | 'S' | 'E' | 'W' = (extras.backDirection as 'N' | 'S' | 'E' | 'W' | undefined)
    ?? (horizontal ? 'N' : 'W');

  const pad = cellSize * 0.10;
  const x = c0 * cellSize + pad;
  const y = r0 * cellSize + pad;
  const w = (c1 - c0 + 1) * cellSize - 2 * pad;
  const h = (r1 - r0 + 1) * cellSize - 2 * pad;
  const radius = cellSize * 0.16;

  // Backrest band occupies ~35% of the short axis along the back side.
  const backFrac = 0.36;

  // Compute backrest band rect + cushion area rect.
  let backRect: { x: number; y: number; w: number; h: number };
  let cushRect: { x: number; y: number; w: number; h: number };
  if (horizontal) {
    const bandH = h * backFrac;
    if (back === 'N') {
      backRect = { x, y, w, h: bandH };
      cushRect = { x, y: y + bandH, w, h: h - bandH };
    } else {
      backRect = { x, y: y + h - bandH, w, h: bandH };
      cushRect = { x, y, w, h: h - bandH };
    }
  } else {
    const bandW = w * backFrac;
    if (back === 'W') {
      backRect = { x, y, w: bandW, h };
      cushRect = { x: x + bandW, y, w: w - bandW, h };
    } else {
      backRect = { x: x + w - bandW, y, w: bandW, h };
      cushRect = { x, y, w: w - bandW, h };
    }
  }

  // Cushion divider lines (between seats) — only inside the cushion area.
  const dividers: React.ReactElement[] = [];
  const longCells = horizontal ? c1 - c0 : r1 - r0;
  for (let k = 1; k <= longCells; k++) {
    if (horizontal) {
      const dx = c0 * cellSize + k * cellSize;
      dividers.push(
        <line key={`d${k}`}
          x1={dx} y1={cushRect.y + cushRect.h * 0.08}
          x2={dx} y2={cushRect.y + cushRect.h - cushRect.h * 0.08}
          stroke={theme.stroke}
          strokeWidth={theme.strokeWidth}
        />,
      );
    } else {
      const dy = r0 * cellSize + k * cellSize;
      dividers.push(
        <line key={`d${k}`}
          x1={cushRect.x + cushRect.w * 0.08} y1={dy}
          x2={cushRect.x + cushRect.w - cushRect.w * 0.08} y2={dy}
          stroke={theme.stroke}
          strokeWidth={theme.strokeWidth}
        />,
      );
    }
  }

  // Cushion-front curve: one shallow arch per seat along the inside edge
  // of the backrest band (suggests each cushion bulges towards the back).
  const cushionArcs: React.ReactElement[] = [];
  const archDepth = cellSize * 0.08;
  for (let k = 0; k <= longCells; k++) {
    if (horizontal) {
      const segStart = c0 * cellSize + k * cellSize + cellSize * 0.18;
      const segEnd = c0 * cellSize + (k + 1) * cellSize - cellSize * 0.18;
      if (segEnd <= segStart) continue;
      const arcY = back === 'N' ? backRect.y + backRect.h : backRect.y;
      const sign = back === 'N' ? 1 : -1;
      const arc = `M ${segStart} ${arcY} Q ${(segStart + segEnd) / 2} ${arcY + sign * archDepth} ${segEnd} ${arcY}`;
      cushionArcs.push(
        <path key={`a${k}`} d={arc}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
          fill="none" />,
      );
    } else {
      const segStart = r0 * cellSize + k * cellSize + cellSize * 0.18;
      const segEnd = r0 * cellSize + (k + 1) * cellSize - cellSize * 0.18;
      if (segEnd <= segStart) continue;
      const arcX = back === 'W' ? backRect.x + backRect.w : backRect.x;
      const sign = back === 'W' ? 1 : -1;
      const arc = `M ${arcX} ${segStart} Q ${arcX + sign * archDepth} ${(segStart + segEnd) / 2} ${arcX} ${segEnd}`;
      cushionArcs.push(
        <path key={`a${k}`} d={arc}
          stroke={theme.detailStroke}
          strokeWidth={theme.detailStrokeWidth}
          fill="none" />,
      );
    }
  }

  return (
    <g className="primitive sofa-run">
      {/* Outer rounded body of the sofa. */}
      <rect
        x={x} y={y} width={w} height={h}
        rx={radius} ry={radius}
        fill={theme.fill === 'none' ? 'rgba(255,255,255,0.07)' : theme.fill}
        stroke={theme.stroke}
        strokeWidth={theme.strokeWidth}
      />
      {/* Backrest band — slightly darker fill to read as "back panel". */}
      <rect
        x={backRect.x} y={backRect.y} width={backRect.w} height={backRect.h}
        fill="rgba(255,255,255,0.10)"
        stroke="none"
      />
      {/* Line separating backrest from cushion area. */}
      {horizontal ? (
        <line
          x1={backRect.x} y1={back === 'N' ? backRect.y + backRect.h : backRect.y}
          x2={backRect.x + backRect.w} y2={back === 'N' ? backRect.y + backRect.h : backRect.y}
          stroke={theme.stroke}
          strokeWidth={theme.strokeWidth}
        />
      ) : (
        <line
          x1={back === 'W' ? backRect.x + backRect.w : backRect.x} y1={backRect.y}
          x2={back === 'W' ? backRect.x + backRect.w : backRect.x} y2={backRect.y + backRect.h}
          stroke={theme.stroke}
          strokeWidth={theme.strokeWidth}
        />
      )}
      {cushionArcs}
      {dividers}
    </g>
  );
}
