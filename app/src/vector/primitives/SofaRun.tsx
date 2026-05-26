import type { PrimitiveProps } from '../types';

type Dir = 'N' | 'S' | 'E' | 'W';

/**
 * Sofa primitive — renders one cushion per shape cell, automatically
 * picking the cell's back direction from the surrounding cells. Mimics
 * the printed top-down sofa look:
 *
 *   1. Per-cell body rect (cells share borders, so a 4-cell row reads
 *      as one block with internal seams between cushions).
 *   2. Backrest band — a darker strip along each cell's back side.
 *   3. Cushion shape inside each cell — a rounded rectangle that only
 *      gets ARMREST side padding when the cell sits at the END of its
 *      run (no neighbour in that direction). Middle cells span the
 *      full cell width so adjacent cushions touch at the seam, matching
 *      the printed art.
 *
 * Back-direction inference (no schema authoring needed for the common
 * cases):
 *   • Pure horizontal row → back = N for every cell.
 *   • Pure vertical column → back = W for every cell.
 *   • L-shape / irregular → per-cell heuristic on which bbox edges the
 *     cell touches, preferring S > E > N > W on ambiguous corners
 *     (so an L-shape corner sofa's bottom row faces up and the right
 *     column faces left — matching the rulebook).
 *
 * extras:
 *   backDirection ('N'|'S'|'E'|'W') — global override for every cell.
 *   cellBacks (Record<"r,c", Dir>) — explicit per-cell overrides.
 */
export function SofaRun({ cells, cellSize, theme, extras }: PrimitiveProps) {
  if (cells.length === 0) return null;
  const rs = cells.map((c) => c[0]);
  const cs = cells.map((c) => c[1]);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  const r1 = Math.max(...rs);
  const c1 = Math.max(...cs);
  const isHorizontal = r0 === r1;
  const isVertical = c0 === c1;
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
  const has = (r: number, c: number) => cellSet.has(`${r},${c}`);

  const globalBack = extras.backDirection as Dir | undefined;
  const cellBacks = (extras.cellBacks as Record<string, Dir> | undefined) ?? {};

  const inferBack = (r: number, c: number): Dir => {
    if (cellBacks[`${r},${c}`]) return cellBacks[`${r},${c}`];
    if (globalBack) return globalBack;
    if (isHorizontal) return 'N';
    if (isVertical) return 'W';
    // L-shape heuristic — pick whichever bbox-edge side has no neighbour.
    const candidates: Dir[] = [];
    if (!has(r - 1, c) && r === r0) candidates.push('N');
    if (!has(r + 1, c) && r === r1) candidates.push('S');
    if (!has(r, c + 1) && c === c1) candidates.push('E');
    if (!has(r, c - 1) && c === c0) candidates.push('W');
    const priority: Dir[] = ['S', 'E', 'N', 'W'];
    for (const p of priority) if (candidates.includes(p)) return p;
    return 'N';
  };

  // Geometry tunables.
  const bandFrac = 0.20;                  // backrest band depth as fraction of cellSize
  const armrestFrac = 0.10;               // side inset on END cells (where the run terminates)
  const frontInsetFrac = 0.04;            // cushion-front inset from the cell's "front" edge
  const cushionRadiusFrac = 0.12;         // rounded-rect corner radius
  const bodyFill = theme.fill === 'none' ? 'rgba(255,255,255,0.05)' : theme.fill;
  const bandFill = 'rgba(0, 0, 0, 0.22)';
  const cushionFill = 'rgba(255,255,255,0.18)';
  const bodyStroke = theme.stroke;
  const bodyStrokeW = theme.strokeWidth * 1.15;
  const cushionStroke = theme.stroke;
  const cushionStrokeW = theme.strokeWidth * 0.95;

  // Build everything per cell so L-shapes work naturally.
  const bodies: React.ReactElement[] = [];
  const bands: React.ReactElement[] = [];
  const cushions: React.ReactElement[] = [];

  cells.forEach(([r, c], i) => {
    const back = inferBack(r, c);
    const cellX = c * cellSize;
    const cellY = r * cellSize;
    const bandPx = cellSize * bandFrac;
    const armrestPx = cellSize * armrestFrac;
    const frontInsetPx = cellSize * frontInsetFrac;

    // Body rect — per cell, no rounded corners so neighbours merge cleanly.
    bodies.push(
      <rect key={`body${i}`}
        x={cellX} y={cellY}
        width={cellSize} height={cellSize}
        fill={bodyFill}
        stroke={bodyStroke}
        strokeWidth={bodyStrokeW}
      />,
    );

    // Backrest band — narrow strip along the back side of THIS cell.
    if (back === 'N') {
      bands.push(<rect key={`band${i}`} x={cellX} y={cellY} width={cellSize} height={bandPx} fill={bandFill} />);
    } else if (back === 'S') {
      bands.push(<rect key={`band${i}`} x={cellX} y={cellY + cellSize - bandPx} width={cellSize} height={bandPx} fill={bandFill} />);
    } else if (back === 'W') {
      bands.push(<rect key={`band${i}`} x={cellX} y={cellY} width={bandPx} height={cellSize} fill={bandFill} />);
    } else {
      bands.push(<rect key={`band${i}`} x={cellX + cellSize - bandPx} y={cellY} width={bandPx} height={cellSize} fill={bandFill} />);
    }

    // Cushion bounds — only end cells (no neighbour along the long axis)
    // get the armrest inset on that side. Middle cells span full width
    // along the long axis so neighbouring cushions touch at the seam.
    let cushX: number, cushY: number, cushW: number, cushH: number;
    if (back === 'N' || back === 'S') {
      // Long axis = E-W. Armrest on sides without a horizontal neighbour.
      const padL = has(r, c - 1) ? 0 : armrestPx;
      const padR = has(r, c + 1) ? 0 : armrestPx;
      cushX = cellX + padL;
      cushW = cellSize - padL - padR;
      if (back === 'N') {
        cushY = cellY + bandPx;
        cushH = cellSize - bandPx - frontInsetPx;
      } else {
        cushY = cellY + frontInsetPx;
        cushH = cellSize - bandPx - frontInsetPx;
      }
    } else {
      // Long axis = N-S. Armrest on top/bottom without vertical neighbour.
      const padT = has(r - 1, c) ? 0 : armrestPx;
      const padB = has(r + 1, c) ? 0 : armrestPx;
      cushY = cellY + padT;
      cushH = cellSize - padT - padB;
      if (back === 'W') {
        cushX = cellX + bandPx;
        cushW = cellSize - bandPx - frontInsetPx;
      } else {
        cushX = cellX + frontInsetPx;
        cushW = cellSize - bandPx - frontInsetPx;
      }
    }

    const rr = cellSize * cushionRadiusFrac;
    cushions.push(
      <rect key={`cush${i}`}
        x={cushX} y={cushY}
        width={cushW} height={cushH}
        rx={rr} ry={rr}
        fill={cushionFill}
        stroke={cushionStroke}
        strokeWidth={cushionStrokeW}
      />,
    );
  });

  return (
    <g className="primitive sofa-run">
      {bodies}
      {bands}
      {cushions}
    </g>
  );
}
