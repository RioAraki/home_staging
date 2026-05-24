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
import { validateWallTopology } from '../lib/walls';
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

function deriveExteriorWalls(cells: string[][], legend: Scenario['grid']['legend']) {
  const isIndoor = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < cells.length && c < (cells[r]?.length ?? 0) &&
    legend[cells[r][c]]?.terrain === 'indoor';
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (!isIndoor(r, c)) continue;
      if (!isIndoor(r - 1, c)) edges.push({ x1: c, y1: r, x2: c + 1, y2: r });
      if (!isIndoor(r + 1, c)) edges.push({ x1: c, y1: r + 1, x2: c + 1, y2: r + 1 });
      if (!isIndoor(r, c - 1)) edges.push({ x1: c, y1: r, x2: c, y2: r + 1 });
      if (!isIndoor(r, c + 1)) edges.push({ x1: c + 1, y1: r, x2: c + 1, y2: r + 1 });
    }
  }
  return edges;
}

export function FloorPlan({ scenario, cellSize = 36 }: FloorPlanProps) {
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
  const chosenVariants = useGameStore((s) => s.chosenVariants);
  const placedCardKeys = useGameStore((s) => s.placedCardKeys);
  const skippedCardKeys = useGameStore((s) => s.skippedCardKeys);
  const playerWalls = useGameStore((s) => s.walls);
  const playerDoors = useGameStore((s) => s.doors);
  const wallPhase = useGameStore((s) => s.wallPhase);
  const toggleWall = useGameStore((s) => s.toggleWall);
  const setDoor = useGameStore((s) => s.setDoor);

  const inWallMode =
    !!activeRoomSlot &&
    isRoomReadyToSeal(
      scenario,
      { chosenVariants, placedCardKeys, skippedCardKeys },
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

        <g className="exterior-walls" transform={`translate(${labelGap}, ${labelGap})`} filter="url(#sketch)">
          {exteriorWalls.map((e, i) => (
            <line key={i} x1={e.x1 * cellSize} y1={e.y1 * cellSize} x2={e.x2 * cellSize} y2={e.y2 * cellSize} />
          ))}
        </g>

        {/* Placed pieces */}
        <g className="placed-pieces" transform={`translate(${labelGap}, ${labelGap})`}>
          {placedPieces.map((p, pi) => {
            const card = cardByNumberVariant(p.number, p.variant);
            const opt = card?.options.find((o) => o.option_index === p.optionIndex);
            if (!opt) return null;
            const t = transformOption(opt, p.rotation, p.mirrored);
            const abs = absoluteCells(t.shape, p.origin);
            const absOpen = absoluteCells(t.open_spaces, p.origin);
            return (
              <g key={pi} className="placed-piece">
                {absOpen.map(([r, c], i) => (
                  <rect key={`o${i}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize}
                        fill="url(#ghost-hatch)" />
                ))}
                {abs.map(([r, c], i) => (
                  <rect key={`s${i}`} x={c * cellSize + 2} y={r * cellSize + 2}
                        width={cellSize - 4} height={cellSize - 4}
                        fill="rgba(255,255,255,0.80)" stroke="#fff" strokeWidth="1.2" />
                ))}
              </g>
            );
          })}
        </g>

        {/* Player walls + doors — no sketch filter (a single straight line has
            a degenerate bbox which makes SVG filters render nothing). */}
        <g className="player-walls" transform={`translate(${labelGap}, ${labelGap})`}>
          {Object.keys(playerWalls).map((key) => {
            const [type, rStr, cStr] = key.split(':');
            const r = parseInt(rStr, 10);
            const c = parseInt(cStr, 10);
            const isDoor = !!playerDoors[key];
            const isDangling = danglingSet.has(key);
            const cls = isDoor ? 'door' : isDangling ? 'wall dangling' : 'wall';
            if (type === 'h') {
              const x1 = c * cellSize;
              const x2 = (c + 1) * cellSize;
              const y = r * cellSize;
              return isDoor ? (
                <line key={key} x1={x1 + 6} y1={y} x2={x2 - 6} y2={y} className={cls} />
              ) : (
                <line key={key} x1={x1} y1={y} x2={x2} y2={y} className={cls} />
              );
            } else {
              const y1 = r * cellSize;
              const y2 = (r + 1) * cellSize;
              const x = c * cellSize;
              return isDoor ? (
                <line key={key} x1={x} y1={y1 + 6} x2={x} y2={y2 - 6} className={cls} />
              ) : (
                <line key={key} x1={x} y1={y1} x2={x} y2={y2} className={cls} />
              );
            }
          })}
        </g>

        {/* Furniture-placement ghost */}
        {!inWallMode && selected && hover && ghostValidity && (
          <g className="ghost" transform={`translate(${labelGap}, ${labelGap})`}>
            {ghostOpenCells.map(([r, c], i) => (
              inBounds([r, c]) ? (
                <rect key={`go${i}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize}
                      fill="url(#ghost-hatch)" opacity={0.7} />
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

        {/* Cell hit-zones (placement only when NOT in wall mode) */}
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

        {/* Edge hit-zones (wall + door drawing) */}
        {inWallMode && (
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
