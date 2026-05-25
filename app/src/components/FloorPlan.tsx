import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Scenario } from '../types';
import {
  useGameStore,
  isRoomReadyToSeal,
  hEdge,
  vEdge,
} from '../store/game';
import { cardByNumberVariant } from '../data';
import {
  transformOption,
  absoluteCells,
  inBounds,
  type Cell,
  type TransformedShape,
} from '../lib/geometry';
import { validatePlacement } from '../lib/validation';
import { validateWallTopology, checkWallEdgeCompliance } from '../lib/walls';
import {
  computeRegions,
  analyseAccessibility,
  analyseOpenSpaceAccessibility,
  findOrphanRegions,
} from '../lib/regions';
import { optionImageUrl } from '../lib/optionImage';
import { FurnitureVector, hasVectorVisual } from '../vector/FurnitureVector';
import type { ThemeId } from '../vector/themes';
import './FloorPlan.css';

interface FloorPlanProps {
  scenario: Scenario;
  cellSize?: number;
}

function parseAsciiGrid(ascii: string) {
  const rows = ascii.replace(/\n+$/, '').split('\n');
  const cells = rows.map((row) => row.split(''));
  const indoor: Cell[] = [];
  for (let r = 0; r < cells.length; r++)
    for (let c = 0; c < cells[r].length; c++)
      if (cells[r][c] !== '.') indoor.push([r, c]);
  return { cells, indoorCells: indoor };
}

interface ExteriorEdge {
  x1: number; y1: number; x2: number; y2: number;
  key: string;                                // canonical edge key h:R:C / v:R:C
  outward: 'N' | 'S' | 'E' | 'W';             // direction from indoor towards outdoor
}

/**
 * Render an architectural-style door symbol: a 45°-open door panel from the
 * hinge plus a quarter-circle arc showing the swing trajectory.
 *
 *   ownerSideCell — the cell on the edge that the door belongs to (player
 *     room owner, or "indoor" for the front door). The door swings AWAY from
 *     this side (per "向外打开" convention).
 *   swingDirOverride — used when ownerSideCell can't be determined.
 */
function renderDoorSymbol(
  edgeKey: string,
  ownerSideCell: [number, number] | null,
  cellSize: number,
  groupClassName: string,
): React.ReactElement {
  const [type, rStr, cStr] = edgeKey.split(':');
  const r = parseInt(rStr, 10);
  const c = parseInt(cStr, 10);
  const L = cellSize;

  // Two cells adjacent to the edge.
  const sideA: [number, number] = type === 'h' ? [r - 1, c] : [r, c - 1];
  const sideB: [number, number] = type === 'h' ? [r, c] : [r, c];

  // swingDir = direction the door opens INTO (= away from owner side).
  // h: -1 = up (toward sideA), +1 = down (toward sideB)
  // v: -1 = left (toward sideA), +1 = right (toward sideB)
  let swingDir: -1 | 1 = 1;
  if (ownerSideCell) {
    if (ownerSideCell[0] === sideA[0] && ownerSideCell[1] === sideA[1]) swingDir = 1;
    else if (ownerSideCell[0] === sideB[0] && ownerSideCell[1] === sideB[1]) swingDir = -1;
  }

  if (type === 'h') {
    // Hinge = left endpoint of edge.
    const hingeX = c * L;
    const hingeY = r * L;
    const closedX = (c + 1) * L;
    const closedY = r * L;
    // Open angle: -45° = up-right, +45° = down-right (from horizontal).
    const angleDeg = swingDir === -1 ? -45 : 45;
    const rad = (angleDeg * Math.PI) / 180;
    const openX = hingeX + L * Math.cos(rad);
    const openY = hingeY + L * Math.sin(rad);
    // SVG arc sweep: 1 = CW in screen coords (y-down).
    const sweep = swingDir === 1 ? 1 : 0;
    const arcPath = `M ${closedX} ${closedY} A ${L} ${L} 0 0 ${sweep} ${openX} ${openY}`;
    return (
      <g key={`door-${edgeKey}`} className={`door-symbol ${groupClassName}`}>
        <line x1={hingeX} y1={hingeY} x2={openX} y2={openY} className="door-panel" />
        <path d={arcPath} className="door-arc" fill="none" />
      </g>
    );
  }

  // Vertical edge: hinge = top endpoint.
  const hingeX = c * L;
  const hingeY = r * L;
  const closedX = c * L;
  const closedY = (r + 1) * L;
  // Closed direction is +90° (straight down). Open +45 (down-right) or 135 (down-left).
  const angleDeg = swingDir === -1 ? 135 : 45;
  const rad = (angleDeg * Math.PI) / 180;
  const openX = hingeX + L * Math.cos(rad);
  const openY = hingeY + L * Math.sin(rad);
  const sweep = swingDir === -1 ? 1 : 0;
  const arcPath = `M ${closedX} ${closedY} A ${L} ${L} 0 0 ${sweep} ${openX} ${openY}`;
  return (
    <g key={`door-${edgeKey}`} className={`door-symbol ${groupClassName}`}>
      <line x1={hingeX} y1={hingeY} x2={openX} y2={openY} className="door-panel" />
      <path d={arcPath} className="door-arc" fill="none" />
    </g>
  );
}

function ownerCellOfDoor(
  edgeKey: string,
  isOwnerCell: (cellKey: string) => boolean,
): [number, number] | null {
  const [type, rStr, cStr] = edgeKey.split(':');
  const r = parseInt(rStr, 10);
  const c = parseInt(cStr, 10);
  const sideA: [number, number] = type === 'h' ? [r - 1, c] : [r, c - 1];
  const sideB: [number, number] = type === 'h' ? [r, c] : [r, c];
  if (isOwnerCell(`${sideA[0]},${sideA[1]}`)) return sideA;
  if (isOwnerCell(`${sideB[0]},${sideB[1]}`)) return sideB;
  return null;
}

function deriveExteriorWalls(cells: string[][], legend: Scenario['grid']['legend']): ExteriorEdge[] {
  const isIndoor = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < cells.length && c < (cells[r]?.length ?? 0) &&
    legend[cells[r][c]]?.terrain === 'indoor';
  const out: ExteriorEdge[] = [];
  const seen = new Set<string>();
  const push = (x1: number, y1: number, x2: number, y2: number, key: string, outward: ExteriorEdge['outward']) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x1, y1, x2, y2, key, outward });
  };
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (!isIndoor(r, c)) continue;
      // Top edge of (r,c) = horizontal edge h:r:c, outdoor is to the NORTH
      if (!isIndoor(r - 1, c)) push(c, r, c + 1, r, `h:${r}:${c}`, 'N');
      // Bottom edge → outdoor SOUTH
      if (!isIndoor(r + 1, c)) push(c, r + 1, c + 1, r + 1, `h:${r + 1}:${c}`, 'S');
      // Left edge → outdoor WEST
      if (!isIndoor(r, c - 1)) push(c, r, c, r + 1, `v:${r}:${c}`, 'W');
      // Right edge → outdoor EAST
      if (!isIndoor(r, c + 1)) push(c + 1, r, c + 1, r + 1, `v:${r}:${c + 1}`, 'E');
    }
  }
  return out;
}

/**
 * Architectural casement window symbol — two leaves hinged at each end of
 * the wall opening, swung outward 45°, with quarter-circle arcs showing
 * the swing path. Matches the visual the user requested ("从左右向外斜
 * 45 度打开").
 */
function renderWindowSymbol(
  edge: ExteriorEdge,
  cellSize: number,
): React.ReactElement {
  const margin = cellSize * 0.06;
  const isHorizontal = edge.y1 === edge.y2;
  // Each leaf is half the opening, so when fully closed they meet in the
  // middle. At 45° open they tilt outward by sin(45°) and shorten on the
  // wall axis by cos(45°).
  const span = (isHorizontal
    ? (edge.x2 - edge.x1) * cellSize
    : (edge.y2 - edge.y1) * cellSize) - 2 * margin;
  const leafLen = span / 2;
  const off = leafLen / Math.SQRT2;   // = leafLen * cos(45°) = leafLen * sin(45°)

  let leftHinge: [number, number], rightHinge: [number, number];
  let leftOpen: [number, number], rightOpen: [number, number];
  let leftClosed: [number, number], rightClosed: [number, number];
  let leftSweep: 0 | 1, rightSweep: 0 | 1;

  if (isHorizontal) {
    const y = edge.y1 * cellSize;
    const xL = edge.x1 * cellSize + margin;
    const xR = edge.x2 * cellSize - margin;
    const sign = edge.outward === 'N' ? -1 : 1;   // outward dy sign
    leftHinge = [xL, y];
    rightHinge = [xR, y];
    leftOpen = [xL + off, y + sign * off];
    rightOpen = [xR - off, y + sign * off];
    leftClosed = [xL + leafLen, y];               // closed = along wall to middle
    rightClosed = [xR - leafLen, y];
    // Arc sweep direction: leaf rotates from closed → open
    // For outward=N (sign=-1): left leaf swings counter-clockwise (sweep=0 in SVG)
    leftSweep = sign === -1 ? 0 : 1;
    rightSweep = sign === -1 ? 1 : 0;
  } else {
    const x = edge.x1 * cellSize;
    const yT = edge.y1 * cellSize + margin;
    const yB = edge.y2 * cellSize - margin;
    const sign = edge.outward === 'W' ? -1 : 1;
    leftHinge = [x, yT];
    rightHinge = [x, yB];
    leftOpen = [x + sign * off, yT + off];
    rightOpen = [x + sign * off, yB - off];
    leftClosed = [x, yT + leafLen];
    rightClosed = [x, yB - leafLen];
    leftSweep = sign === -1 ? 1 : 0;
    rightSweep = sign === -1 ? 0 : 1;
  }

  const arcRadius = leafLen;
  // SVG arc: M start A rx ry x-axis-rotation large-arc-flag sweep-flag x y
  const leftArc = `M ${leftClosed[0]} ${leftClosed[1]} A ${arcRadius} ${arcRadius} 0 0 ${leftSweep} ${leftOpen[0]} ${leftOpen[1]}`;
  const rightArc = `M ${rightClosed[0]} ${rightClosed[1]} A ${arcRadius} ${arcRadius} 0 0 ${rightSweep} ${rightOpen[0]} ${rightOpen[1]}`;

  return (
    <g key={`window-${edge.key}`} className="window-symbol">
      {/* Left leaf panel + swing arc */}
      <line x1={leftHinge[0]} y1={leftHinge[1]} x2={leftOpen[0]} y2={leftOpen[1]} className="window-leaf" />
      <path d={leftArc} className="window-arc" fill="none" />
      {/* Right leaf panel + swing arc */}
      <line x1={rightHinge[0]} y1={rightHinge[1]} x2={rightOpen[0]} y2={rightOpen[1]} className="window-leaf" />
      <path d={rightArc} className="window-arc" fill="none" />
    </g>
  );
}

export function FloorPlan({ scenario, cellSize = 48 }: FloorPlanProps) {
  const { cells, indoorCells, walls: exteriorWalls } = useMemo(() => {
    const parsed = parseAsciiGrid(scenario.grid.ascii);
    const w = deriveExteriorWalls(parsed.cells, scenario.grid.legend);
    return { cells: parsed.cells, indoorCells: parsed.indoorCells, walls: w };
  }, [scenario]);

  const rows = 16;
  const cols = 16;
  const labelGap = 24;
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;
  const totalW = gridW + labelGap * 2;
  const totalH = gridH + labelGap * 2;

  const colLetters = Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i));
  const rowNumbers = Array.from({ length: rows }, (_, i) => i + 1);

  const selected = useGameStore((s) => s.selectedOption);
  const placedPieces = useGameStore((s) => s.placedPieces);
  const rotateSelection = useGameStore((s) => s.rotateSelection);
  const placeSelected = useGameStore((s) => s.placeSelected);
  const setError = useGameStore((s) => s.setError);

  const activeRoomSlot = useGameStore((s) => s.activeRoomSlot);
  const placedCardKeys = useGameStore((s) => s.placedCardKeys);
  const skippedCardKeys = useGameStore((s) => s.skippedCardKeys);
  const playerWalls = useGameStore((s) => s.walls);
  const playerDoors = useGameStore((s) => s.doors);
  const wallPhase = useGameStore((s) => s.wallPhase);
  const toggleWall = useGameStore((s) => s.toggleWall);
  const setDoor = useGameStore((s) => s.setDoor);
  const frontDoorEdge = useGameStore((s) => s.frontDoorEdge);
  const frontDoorMode = useGameStore((s) => s.frontDoorMode);
  const setFrontDoor = useGameStore((s) => s.setFrontDoor);
  const windows = useGameStore((s) => s.windows);
  const windowMode = useGameStore((s) => s.windowMode);
  const toggleWindow = useGameStore((s) => s.toggleWindow);
  const themeId = useGameStore((s) => s.themeId) as ThemeId;

  const inWallMode =
    !!activeRoomSlot &&
    isRoomReadyToSeal(
      scenario,
      { placedCardKeys, skippedCardKeys },
      activeRoomSlot,
    );

  // Live topology check — used to colour dangling walls red as the player draws.
  const wallTopology = useMemo(
    () => (inWallMode ? validateWallTopology(scenario, playerWalls) : null),
    [inWallMode, scenario, playerWalls],
  );
  const danglingSet = useMemo(
    () => new Set(wallTopology?.danglingWalls ?? []),
    [wallTopology],
  );

  const completedRoomSlots = useGameStore((s) => s.completedRoomSlots);

  // Pieces that won't score — same logic as scoring.ts. Flag once the
  // piece's room is either sealed OR has at least one door drawn for it
  // (which is the earliest moment the open-space accessibility check makes
  // sense — before that, no door cell to start the BFS from).
  const ignoredPieceFlags = useMemo(() => {
    const out = new Set<number>();
    const roomsWithDoor = new Set<string>();
    for (const owner of Object.values(playerDoors)) roomsWithDoor.add(owner);
    const eligibleRooms = new Set<string>([
      ...completedRoomSlots,
      ...roomsWithDoor,
    ]);
    if (eligibleRooms.size === 0) return out;
    const access = analyseAccessibility(
      scenario, placedPieces, playerWalls, playerDoors, frontDoorEdge,
    );
    const pieceAccess = analyseOpenSpaceAccessibility(
      scenario, placedPieces, playerWalls, playerDoors, access,
    );
    const wallEdgeViolators = new Set(
      checkWallEdgeCompliance(scenario, placedPieces, playerWalls, playerDoors)
        .violations.map((v) => v.pieceIndex),
    );
    placedPieces.forEach((p, idx) => {
      if (!eligibleRooms.has(p.roomSlot)) return;
      const valid = pieceAccess.validPieceIndices.has(idx) && !wallEdgeViolators.has(idx);
      if (!valid) out.add(idx);
    });
    return out;
  }, [scenario, placedPieces, playerWalls, playerDoors, frontDoorEdge, completedRoomSlots]);

  // Wall-edge requirements that aren't currently satisfied — shown as a
  // yellow dashed glow on the exact edge that needs a wall, so the player
  // sees WHICH side of which piece is missing its required wall and can
  // rotate or move instead of guessing.
  const unsatisfiedWallEdges = useMemo(() => {
    const out: string[] = [];
    const compliance = checkWallEdgeCompliance(scenario, placedPieces, playerWalls, playerDoors);
    for (const v of compliance.violations) {
      for (const req of v.missing) out.push(req.edgeKey);
    }
    return out;
  }, [scenario, placedPieces, playerWalls, playerDoors]);

  // Orphan regions — indoor cells that the player walled off into a dead
  // pocket (no furniture inside AND unreachable from the front door via the
  // door graph). Highlighted in red so the player notices.
  const orphanCellSet = useMemo(() => {
    if (!frontDoorEdge) return new Set<string>();
    const access = analyseAccessibility(
      scenario, placedPieces, playerWalls, playerDoors, frontDoorEdge,
    );
    const { cells } = findOrphanRegions(access, !!frontDoorEdge);
    return new Set(cells);
  }, [scenario, placedPieces, playerWalls, playerDoors, frontDoorEdge]);

  const [hover, setHover] = useState<Cell | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        rotateSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, rotateSelection]);

  // Compute room regions (walls — including doors — block flood fill). Used
  // to determine which side of a door belongs to its owner room, so the door
  // symbol always swings outward (away from the owner).
  const regionMap = useMemo(
    () => computeRegions(scenario, playerWalls),
    [scenario, playerWalls],
  );

  const ownerRegionByRoom = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of placedPieces) {
      if (m.has(p.roomSlot)) continue;
      const card = cardByNumberVariant(p.number, p.variant);
      const opt = card?.options.find((o) => o.option_index === p.optionIndex);
      if (!opt) continue;
      const t = transformOption(opt, p.rotation, p.mirrored);
      for (const [r, c] of absoluteCells(t.shape, p.origin)) {
        const reg = regionMap.cellToRegion.get(`${r},${c}`);
        if (reg !== undefined) { m.set(p.roomSlot, reg); break; }
      }
    }
    return m;
  }, [placedPieces, regionMap]);

  const transformedSel: TransformedShape | null = useMemo(() => {
    if (!selected) return null;
    const card = cardByNumberVariant(selected.number, selected.variant);
    const opt = card?.options.find((o) => o.option_index === selected.optionIndex);
    if (!opt) return null;
    return transformOption(opt, selected.rotation, selected.mirrored);
  }, [selected]);

  const ghostValidity = useMemo(() => {
    if (!selected || !transformedSel || !hover) return null;
    return validatePlacement(scenario, transformedSel, hover, placedPieces);
  }, [selected, transformedSel, hover, scenario, placedPieces]);

  const ghostCells: Cell[] = useMemo(() => {
    if (!transformedSel || !hover) return [];
    return absoluteCells(transformedSel.shape, hover);
  }, [transformedSel, hover]);

  const ghostOpenCells: Cell[] = useMemo(() => {
    if (!transformedSel || !hover) return [];
    return absoluteCells(transformedSel.open_spaces, hover);
  }, [transformedSel, hover]);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (inWallMode) return;
      if (!selected || !transformedSel) return;
      const result = validatePlacement(scenario, transformedSel, [r, c], placedPieces);
      if (!result.valid) {
        setError(result.reason ?? 'Invalid placement');
        return;
      }
      placeSelected([r, c]);
    },
    [inWallMode, selected, transformedSel, scenario, placedPieces, placeSelected, setError],
  );

  const handleCellEnter = (r: number, c: number) => {
    if (!selected) { if (hover) setHover(null); return; }
    setHover([r, c]);
  };

  const handleEdgeClick = (edgeKey: string) => {
    if (!inWallMode) return;
    if (wallPhase === 'walls') toggleWall(edgeKey);
    else setDoor(edgeKey);
  };

  // Edge hit-zone thickness
  const HIT = 12;

  return (
    <div className="floor-plan-wrap">
      <svg
        className="floor-plan"
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        onMouseLeave={() => { setHover(null); setHoverEdge(null); }}
      >
        <defs>
          <filter id="sketch">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
          <pattern id="ghost-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x={labelGap} y={labelGap} width={gridW} height={gridH} className="paper-bg" />

        <g className="gridlines" transform={`translate(${labelGap}, ${labelGap})`}>
          {Array.from({ length: cols + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * cellSize} y1={0} x2={i * cellSize} y2={gridH} />
          ))}
          {Array.from({ length: rows + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * cellSize} x2={gridW} y2={i * cellSize} />
          ))}
        </g>

        <g className="col-labels">
          {colLetters.map((ch, i) => (
            <text key={ch} x={labelGap + i * cellSize + cellSize / 2} y={labelGap - 6} textAnchor="middle">
              {ch}
            </text>
          ))}
        </g>
        <g className="row-labels">
          {rowNumbers.map((n, i) => (
            <text key={n} x={labelGap - 6} y={labelGap + i * cellSize + cellSize / 2 + 4} textAnchor="end">
              {n}
            </text>
          ))}
        </g>

        <g className="indoor-cells" transform={`translate(${labelGap}, ${labelGap})`}>
          {indoorCells.map(([r, c]) => (
            <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} className="indoor" />
          ))}
        </g>

        {/* Orphan-region overlay — indoor cells the player walled off into a
            dead pocket (no door connection to outside, no furniture). */}
        {orphanCellSet.size > 0 && (
          <g className="orphan-cells" transform={`translate(${labelGap}, ${labelGap})`}>
            {Array.from(orphanCellSet).map((k) => {
              const [rs, cs] = k.split(',');
              const r = parseInt(rs, 10);
              const c = parseInt(cs, 10);
              return (
                <rect key={`orph-${k}`}
                  x={c * cellSize} y={r * cellSize}
                  width={cellSize} height={cellSize}
                  fill="rgba(255, 80, 80, 0.18)"
                  stroke="var(--danger)"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                  pointerEvents="none" />
              );
            })}
          </g>
        )}

        <g className="exterior-walls" transform={`translate(${labelGap}, ${labelGap})`} filter="url(#sketch)">
          {exteriorWalls.map((e, i) => {
            // Skip drawing the wall segment that's been turned into the front door
            // — the door symbol layer below renders it instead.
            if (e.key === frontDoorEdge) return null;
            return (
              <line
                key={i}
                x1={e.x1 * cellSize}
                y1={e.y1 * cellSize}
                x2={e.x2 * cellSize}
                y2={e.y2 * cellSize}
              />
            );
          })}
        </g>

        {/* Front door symbol — drawn separately so it doesn't carry the sketch
            wobble filter (which would distort the clean arc). Owner side =
            any indoor cell (front door always swings out into the outdoors). */}
        {frontDoorEdge && (
          <g className="front-door-symbol-layer" transform={`translate(${labelGap}, ${labelGap})`}>
            {renderDoorSymbol(
              frontDoorEdge,
              ownerCellOfDoor(
                frontDoorEdge,
                (k) => regionMap.cellToRegion.has(k),
              ),
              cellSize,
              'front-door-symbol',
            )}
          </g>
        )}

        {/* Windows — architectural symbol: small rectangle protruding from the
            wall on the outdoor side, with diagonal-hatch glass fill. */}
        <g className="windows-layer" transform={`translate(${labelGap}, ${labelGap})`}>
          {exteriorWalls
            .filter((e) => windows[e.key])
            .map((e) => renderWindowSymbol(e, cellSize))}
        </g>

        {/* Hit-zones along the exterior wall — for window-mode (toggle) */}
        {windowMode && (
          <g className="window-hit" transform={`translate(${labelGap}, ${labelGap})`}>
            {exteriorWalls.map((e, i) => {
              const isHorizontal = e.y1 === e.y2;
              const isHovered = hoverEdge === e.key;
              const isOn = !!windows[e.key];
              const stroke = isHovered
                ? '#6fb3d6'
                : isOn ? 'rgba(111,179,214,0.7)' : 'rgba(111,179,214,0.30)';
              const sw = isHovered ? 6 : 4;
              const common = {
                stroke, strokeWidth: sw, strokeDasharray: '3 2',
                style: { cursor: 'pointer' as const },
                onMouseEnter: () => setHoverEdge(e.key),
                onMouseLeave: () => setHoverEdge(null),
                onClick: () => toggleWindow(e.key),
              };
              if (isHorizontal) {
                return (
                  <line key={`winhit-h-${i}`}
                    x1={e.x1 * cellSize} y1={e.y1 * cellSize}
                    x2={e.x2 * cellSize} y2={e.y2 * cellSize}
                    {...common} />
                );
              }
              return (
                <line key={`winhit-v-${i}`}
                  x1={e.x1 * cellSize} y1={e.y1 * cellSize}
                  x2={e.x2 * cellSize} y2={e.y2 * cellSize}
                  {...common} />
              );
            })}
          </g>
        )}

        {/* Hit-zones along the exterior wall — only active in front-door mode */}
        {frontDoorMode && (
          <g className="front-door-hit" transform={`translate(${labelGap}, ${labelGap})`}>
            {exteriorWalls.map((e, i) => {
              const isHorizontal = e.y1 === e.y2;
              const isHovered = hoverEdge === e.key;
              const stroke = isHovered ? 'var(--accent)' : 'rgba(255,225,105,0.35)';
              const sw = isHovered ? 6 : 4;
              if (isHorizontal) {
                return (
                  <line
                    key={`fdh-${i}`}
                    x1={e.x1 * cellSize}
                    y1={e.y1 * cellSize}
                    x2={e.x2 * cellSize}
                    y2={e.y2 * cellSize}
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeDasharray="3 2"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverEdge(e.key)}
                    onMouseLeave={() => setHoverEdge(null)}
                    onClick={() => setFrontDoor(e.key)}
                  />
                );
              }
              return (
                <line
                  key={`fdv-${i}`}
                  x1={e.x1 * cellSize}
                  y1={e.y1 * cellSize}
                  x2={e.x2 * cellSize}
                  y2={e.y2 * cellSize}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeDasharray="3 2"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoverEdge(e.key)}
                  onMouseLeave={() => setHoverEdge(null)}
                  onClick={() => setFrontDoor(e.key)}
                />
              );
            })}
          </g>
        )}

        {/* Placed pieces */}
        <g className="placed-pieces" transform={`translate(${labelGap}, ${labelGap})`}>
          {placedPieces.map((p, pi) => {
            const card = cardByNumberVariant(p.number, p.variant);
            const opt = card?.options.find((o) => o.option_index === p.optionIndex);
            if (!opt) return null;
            const t = transformOption(opt, p.rotation, p.mirrored);
            const abs = absoluteCells(t.shape, p.origin);
            const absOpen = absoluteCells(t.open_spaces, p.origin);

            // Render the actual option artwork rotated/mirrored over the bbox.
            const [origH, origW] = opt.bbox;
            const tH = p.rotation % 2 === 0 ? origH : origW;
            const tW = p.rotation % 2 === 0 ? origW : origH;
            const cellOriginX = p.origin[1] * cellSize;
            const cellOriginY = p.origin[0] * cellSize;
            const centerX = cellOriginX + (tW * cellSize) / 2;
            const centerY = cellOriginY + (tH * cellSize) / 2;
            const origPxW = origW * cellSize;
            const origPxH = origH * cellSize;
            const url = optionImageUrl(p.number, p.variant, p.optionIndex);

            const useVector = hasVectorVisual(p.number, p.variant, p.optionIndex);
            // Clip the scanned card crop to SHAPE cells only. Open-space and
            // void cells render transparent — the open-space marker is just
            // the centre dot below, so the scan's imprecise cell borders
            // don't bleed in.
            const visibleCells: Array<[number, number]> = opt.shape.map(
              ([r, c]) => [r, c],
            );
            const clipId = `piece-clip-${pi}-${p.number}-${p.variant}-${p.optionIndex}`;
            const isIgnored = ignoredPieceFlags.has(pi);
            return (
              <g key={pi} className={`placed-piece ${isIgnored ? 'ignored' : ''}`}>
                {!useVector && (
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
                )}
                {/* Open-space marker — a single dot at each open-space cell centre. */}
                {absOpen.map(([r, c], i) => (
                  <circle
                    key={`o${i}`}
                    cx={c * cellSize + cellSize / 2}
                    cy={r * cellSize + cellSize / 2}
                    r={Math.max(2, cellSize * 0.07)}
                    className="open-space-dot"
                  />
                ))}
                {/* Subtle indoor-tint behind the artwork — only at SHAPE cells
                    so void bbox cells stay clear. */}
                {abs.map(([r, c], i) => (
                  <rect key={`bg${i}`} x={c * cellSize} y={r * cellSize}
                        width={cellSize} height={cellSize}
                        fill="rgba(255,255,255,0.10)" />
                ))}
                {/* Furniture body — vector primitives when a visual schema
                    exists, otherwise fall back to the (clipped) raster crop. */}
                <g
                  transform={`translate(${centerX}, ${centerY}) rotate(${p.rotation * 90}) scale(${p.mirrored ? -1 : 1}, 1)`}
                  className={useVector ? 'piece-vector' : 'piece-art'}
                >
                  {useVector ? (
                    <g transform={`translate(${-origPxW / 2}, ${-origPxH / 2})`}>
                      <FurnitureVector
                        number={p.number}
                        variant={p.variant}
                        optionIndex={p.optionIndex}
                        rows={origH}
                        cols={origW}
                        cellSize={cellSize}
                        themeId={themeId}
                      />
                    </g>
                  ) : (
                    <image
                      href={url}
                      x={-origPxW / 2}
                      y={-origPxH / 2}
                      width={origPxW}
                      height={origPxH}
                      preserveAspectRatio="none"
                      clipPath={`url(#${clipId})`}
                    />
                  )}
                </g>
                {/* Thin border on each shape cell for clarity */}
                {abs.map(([r, c], i) => (
                  <rect key={`s${i}`} x={c * cellSize + 0.5} y={r * cellSize + 0.5}
                        width={cellSize - 1} height={cellSize - 1}
                        fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.6"
                        pointerEvents="none" />
                ))}
                {/* Ignored overlay — red tint + red dashed border on every
                    shape cell. Triggered when the piece's room is sealed
                    but the piece won't score (open-space blocked / wall-edge
                    unmet / room unreachable). Player can undo to fix. */}
                {isIgnored && abs.map(([r, c], i) => (
                  <rect key={`ign${i}`} x={c * cellSize + 1.5} y={r * cellSize + 1.5}
                        width={cellSize - 3} height={cellSize - 3}
                        fill="rgba(255, 80, 80, 0.18)"
                        stroke="var(--danger)" strokeWidth="2"
                        strokeDasharray="4 2"
                        pointerEvents="none" />
                ))}
              </g>
            );
          })}
        </g>

        {/* Player walls — solid lines. Doors are rendered separately below. */}
        <g className="player-walls" transform={`translate(${labelGap}, ${labelGap})`}>
          {Object.keys(playerWalls).map((key) => {
            if (playerDoors[key]) return null;  // doors handled below
            const [type, rStr, cStr] = key.split(':');
            const r = parseInt(rStr, 10);
            const c = parseInt(cStr, 10);
            const isDangling = danglingSet.has(key);
            const cls = isDangling ? 'wall dangling' : 'wall';
            if (type === 'h') {
              return <line key={key} x1={c * cellSize} y1={r * cellSize} x2={(c + 1) * cellSize} y2={r * cellSize} className={cls} />;
            }
            return <line key={key} x1={c * cellSize} y1={r * cellSize} x2={c * cellSize} y2={(r + 1) * cellSize} className={cls} />;
          })}
        </g>

        {/* Player room doors — architectural 45° swing symbol. Owner side =
            cell whose region matches the owner room's region (so the door
            swings away from the room → "外开"). */}
        <g className="player-doors" transform={`translate(${labelGap}, ${labelGap})`}>
          {Object.entries(playerDoors).map(([edgeKey, ownerSlot]) => {
            const ownerReg = ownerRegionByRoom.get(ownerSlot);
            const ownerCell =
              ownerReg !== undefined
                ? ownerCellOfDoor(
                    edgeKey,
                    (k) => regionMap.cellToRegion.get(k) === ownerReg,
                  )
                : null;
            return renderDoorSymbol(edgeKey, ownerCell, cellSize, 'room-door');
          })}
        </g>

        {/* Wall-edge requirements that aren't satisfied — yellow glow on
            the specific edges that need walls, so the player can see WHERE
            to rotate / move the offending piece. */}
        <g className="needs-wall-layer" transform={`translate(${labelGap}, ${labelGap})`}>
          {unsatisfiedWallEdges.map((ek, i) => {
            const [type, rStr, cStr] = ek.split(':');
            const r = parseInt(rStr, 10);
            const c = parseInt(cStr, 10);
            const props = type === 'h'
              ? { x1: c * cellSize, y1: r * cellSize, x2: (c + 1) * cellSize, y2: r * cellSize }
              : { x1: c * cellSize, y1: r * cellSize, x2: c * cellSize, y2: (r + 1) * cellSize };
            return <line key={`needs-${i}`} {...props} className="needs-wall" />;
          })}
        </g>

        {/* Furniture-placement ghost */}
        {!inWallMode && selected && hover && ghostValidity && (
          <g className="ghost" transform={`translate(${labelGap}, ${labelGap})`}>
            {ghostOpenCells.map(([r, c], i) => (
              inBounds([r, c]) ? (
                <circle
                  key={`go${i}`}
                  cx={c * cellSize + cellSize / 2}
                  cy={r * cellSize + cellSize / 2}
                  r={Math.max(2, cellSize * 0.07)}
                  className="open-space-dot ghost"
                />
              ) : null
            ))}
            {ghostCells.map(([r, c], i) => {
              const stroke = ghostValidity.valid ? 'var(--accent)' : 'var(--danger)';
              const fill = ghostValidity.valid ? 'rgba(255,225,105,0.45)' : 'rgba(255,123,123,0.45)';
              return (
                <rect key={`g${i}`} x={c * cellSize + 1} y={r * cellSize + 1}
                      width={cellSize - 2} height={cellSize - 2}
                      fill={fill} stroke={stroke} strokeWidth="1.5"
                      style={{ pointerEvents: 'none' }} />
              );
            })}
          </g>
        )}

        {/* Edge hover preview during wall mode */}
        {inWallMode && hoverEdge && (
          <g className="edge-hover" transform={`translate(${labelGap}, ${labelGap})`}>
            {(() => {
              const [type, rStr, cStr] = hoverEdge.split(':');
              const r = parseInt(rStr, 10);
              const c = parseInt(cStr, 10);
              // In door phase, only highlight if it's an existing wall
              if (wallPhase === 'door' && !playerWalls[hoverEdge]) return null;
              const stroke = wallPhase === 'door' ? 'var(--accent)' : 'var(--accent)';
              if (type === 'h') {
                return (
                  <line x1={c * cellSize} y1={r * cellSize}
                        x2={(c + 1) * cellSize} y2={r * cellSize}
                        stroke={stroke} strokeWidth="4" opacity={0.55} />
                );
              }
              return (
                <line x1={c * cellSize} y1={r * cellSize}
                      x2={c * cellSize} y2={(r + 1) * cellSize}
                      stroke={stroke} strokeWidth="4" opacity={0.55} />
              );
            })()}
          </g>
        )}

        {/* Cell hit-zones (placement only when NOT in wall/front-door/window mode) */}
        {!frontDoorMode && !windowMode && (
        <g className="cell-hit" transform={`translate(${labelGap}, ${labelGap})`}>
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (__, c) => (
              <rect
                key={`hit-${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="transparent"
                onMouseEnter={() => handleCellEnter(r, c)}
                onClick={() => handleCellClick(r, c)}
                style={{ cursor: selected && !inWallMode ? 'crosshair' : 'default' }}
              />
            )),
          )}
        </g>
        )}

        {/* Edge hit-zones (wall + door drawing) */}
        {inWallMode && !frontDoorMode && !windowMode && (
          <g className="edge-hit" transform={`translate(${labelGap}, ${labelGap})`}>
            {Array.from({ length: rows + 1 }, (_, r) =>
              Array.from({ length: cols }, (__, c) => (
                <rect
                  key={`he-${r}-${c}`}
                  x={c * cellSize}
                  y={r * cellSize - HIT / 2}
                  width={cellSize}
                  height={HIT}
                  fill="transparent"
                  onMouseEnter={() => setHoverEdge(hEdge(r, c))}
                  onMouseLeave={() => setHoverEdge(null)}
                  onClick={() => handleEdgeClick(hEdge(r, c))}
                  style={{ cursor: 'pointer' }}
                />
              )),
            )}
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols + 1 }, (__, c) => (
                <rect
                  key={`ve-${r}-${c}`}
                  x={c * cellSize - HIT / 2}
                  y={r * cellSize}
                  width={HIT}
                  height={cellSize}
                  fill="transparent"
                  onMouseEnter={() => setHoverEdge(vEdge(r, c))}
                  onMouseLeave={() => setHoverEdge(null)}
                  onClick={() => handleEdgeClick(vEdge(r, c))}
                  style={{ cursor: 'pointer' }}
                />
              )),
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
