import { Graphics, Color } from 'cc';
import type { Scenario, PreDrawnDoor, RoomSlot } from '../core/types';
import type { PlacedPiece } from '../state/gameStore';
import { computeRegions, assignRoomsToRegions } from '../core/regions';
import { layout, edgeX, edgeY } from './viewport';

// ── Design tokens (translated from React blueprint aesthetic) ─────────────────
// React app lives on a dark navy background; the Cocos port uses a light cream
// background instead (easier to read on mobile). Colours below are tuned for
// that light-paper look.
const COL_BG       = new Color(16,  42,  71,  255);  // navy blueprint canvas
const COL_INDOOR   = new Color(255, 255, 255, 16);   // translucent white fill
const COL_OUTDOOR  = COL_BG;                          // outdoor blends into canvas
const COL_WATER    = new Color(150, 180, 220, 255);
const COL_ROAD     = new Color(180, 180, 180, 255);
const COL_OBSTACLE = new Color(100, 100, 100, 255);

const COL_INDOOR_BORDER = new Color(255, 255, 255, 242);  // thick white outline
const COL_GRIDLINE = new Color(255, 255, 255, 46);   // faint white pencil
const COL_WALL     = new Color(255, 255, 255, 235);  // white architectural line
const COL_DOOR     = new Color(255, 220,  90, 255);  // yellow door
const COL_WINDOW   = new Color(168, 216, 238, 255);  // #a8d8ee light blue
const COL_PREDRAWN = new Color(50,  60,  90,  200);  // slightly lighter navy

const WALL_WIDTH   = 5;
const DOOR_WIDTH   = 3;
const WIN_WIDTH    = 3;
// ─────────────────────────────────────────────────────────────────────────────

export function drawGridBg(g: Graphics, scenario: Scenario) {
  g.clear();

  const ascii = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
  const legend = scenario.grid.legend;
  const { cell, r0, c0, rows, cols, w, h } = layout();

  const isIndoor = (r: number, c: number): boolean => {
    if (r < r0 || c < c0 || r >= r0 + rows || c >= c0 + cols) return false;
    const ch = ascii[r]?.[c] ?? '.';
    return legend[ch]?.terrain === 'indoor';
  };

  // 1) Fill the entire crop area with the navy blueprint canvas.
  g.fillColor = COL_BG;
  g.rect(edgeX(c0), edgeY(r0 + rows), w, h);
  g.fill();

  // 2) Overlay indoor cells with a translucent white wash (plus any special
  //    terrain like water/road/obstacle so those stay visible).
  for (let r = r0; r < r0 + rows; r++) {
    for (let c = c0; c < c0 + cols; c++) {
      const ch = ascii[r]?.[c] ?? '.';
      const terrain = legend[ch]?.terrain;
      if (terrain === 'indoor' || terrain === 'water' ||
          terrain === 'road' || terrain === 'obstacle') {
        g.fillColor = fillColorFor(terrain);
        // edgeY(r) is the top of the cell; bottom-left corner is edgeY(r)-cell.
        g.rect(edgeX(c), edgeY(r) - cell, cell, cell);
        g.fill();
      }
    }
  }

  // 3) Faint white grid lines.
  g.strokeColor = COL_GRIDLINE;
  g.lineWidth = 1;
  for (let c = c0; c <= c0 + cols; c++) {
    const x = edgeX(c);
    g.moveTo(x, -h / 2);
    g.lineTo(x, h / 2);
  }
  for (let r = r0; r <= r0 + rows; r++) {
    const y = edgeY(r);
    g.moveTo(-w / 2, y);
    g.lineTo(w / 2, y);
  }
  g.stroke();

  // 4) Thick white indoor border: for each indoor cell, stroke any side whose
  //    neighbour is not indoor — this traces the floor-plan outline exactly,
  //    even for non-rectangular rooms.
  g.strokeColor = COL_INDOOR_BORDER;
  g.lineWidth = 5;
  for (let r = r0; r < r0 + rows; r++) {
    for (let c = c0; c < c0 + cols; c++) {
      if (!isIndoor(r, c)) continue;
      if (!isIndoor(r - 1, c)) {  // top
        g.moveTo(edgeX(c),     edgeY(r));
        g.lineTo(edgeX(c + 1), edgeY(r));
      }
      if (!isIndoor(r + 1, c)) {  // bottom
        g.moveTo(edgeX(c),     edgeY(r + 1));
        g.lineTo(edgeX(c + 1), edgeY(r + 1));
      }
      if (!isIndoor(r, c - 1)) {  // left
        g.moveTo(edgeX(c), edgeY(r));
        g.lineTo(edgeX(c), edgeY(r + 1));
      }
      if (!isIndoor(r, c + 1)) {  // right
        g.moveTo(edgeX(c + 1), edgeY(r));
        g.lineTo(edgeX(c + 1), edgeY(r + 1));
      }
    }
  }
  g.stroke();
}

function fillColorFor(terrain?: string): Color {
  switch (terrain) {
    case 'indoor':   return COL_INDOOR;
    case 'outdoor':  return COL_OUTDOOR;
    case 'water':    return COL_WATER;
    case 'road':     return COL_ROAD;
    case 'obstacle': return COL_OBSTACLE;
    default:         return new Color(255, 255, 255, 0);
  }
}

export function drawWalls(g: Graphics, walls: Record<string, true>, color: Color = COL_WALL) {
  g.clear();
  g.strokeColor = color;
  g.lineWidth = WALL_WIDTH;
  for (const key of Object.keys(walls)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    if (type === 'h') {
      g.moveTo(edgeX(c),     edgeY(r));
      g.lineTo(edgeX(c + 1), edgeY(r));
    } else {
      g.moveTo(edgeX(c), edgeY(r));
      g.lineTo(edgeX(c), edgeY(r + 1));
    }
  }
  g.stroke();
}

type Outward = 'up' | 'down' | 'left' | 'right';

function makeIsIndoor(scenario: Scenario): (r: number, c: number) => boolean {
  const ascii = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
  const legend = scenario.grid.legend;
  return (r, c) => {
    const ch = ascii[r]?.[c];
    return !!ch && legend[ch]?.terrain === 'indoor';
  };
}

/**
 * Architectural door/window symbol: a solid 45° panel + a DASHED quarter-arc
 * showing the swing, drawn opening OUTWARD (toward `outward`). Hinge is the
 * top-left endpoint of the edge (same convention as walls).
 */
function drawSwingArc(
  g: Graphics, type: string, r: number, c: number, L: number,
  color: Color, lineW: number, outward: Outward,
) {
  const hingeX = edgeX(c), hingeY = edgeY(r);
  let closed: number, open: number;
  if (type === 'h') {
    closed = 0;                                          // along the edge (→)
    open = outward === 'up' ? Math.PI / 4 : -Math.PI / 4;
  } else {
    closed = -Math.PI / 2;                               // along the edge (↓)
    open = outward === 'right' ? -Math.PI / 4 : -3 * Math.PI / 4;
  }
  g.strokeColor = color;
  g.lineWidth = lineW;
  // Solid panel.
  g.moveTo(hingeX, hingeY);
  g.lineTo(hingeX + L * Math.cos(open), hingeY + L * Math.sin(open));
  g.stroke();
  // Dashed swing arc (segments with gaps).
  const steps = 14;
  for (let i = 0; i < steps; i += 2) {
    const t0 = closed + (open - closed) * (i / steps);
    const t1 = closed + (open - closed) * ((i + 1) / steps);
    g.moveTo(hingeX + L * Math.cos(t0), hingeY + L * Math.sin(t0));
    g.lineTo(hingeX + L * Math.cos(t1), hingeY + L * Math.sin(t1));
  }
  g.stroke();
}

/** Swing toward the non-indoor side of an edge (used for windows / pre-drawn). */
function outwardByTerrain(
  type: string, r: number, c: number, isIndoor: (r: number, c: number) => boolean,
): Outward {
  if (type === 'h') {
    const up = isIndoor(r - 1, c), down = isIndoor(r, c);
    if (up && !down) return 'down';
    if (down && !up) return 'up';
    return 'up';
  }
  const left = isIndoor(r, c - 1), right = isIndoor(r, c);
  if (left && !right) return 'right';
  if (right && !left) return 'left';
  return 'right';
}

/** Swing away from the owner room's region (used for player doors). */
function outwardByRegion(
  type: string, r: number, c: number,
  ownerReg: number | undefined, cellToRegion: Map<string, number>,
): Outward {
  if (type === 'h') {
    if (cellToRegion.get(`${r},${c}`) === ownerReg) return 'up';
    if (cellToRegion.get(`${r - 1},${c}`) === ownerReg) return 'down';
    return 'down';
  }
  if (cellToRegion.get(`${r},${c}`) === ownerReg) return 'left';
  if (cellToRegion.get(`${r},${c - 1}`) === ownerReg) return 'right';
  return 'right';
}

/** Player doors — yellow, opening outward (away from the owning room). */
export function drawDoors(
  g: Graphics, doors: Record<string, RoomSlot>,
  scenario: Scenario, walls: Record<string, true>, placedPieces: PlacedPiece[],
) {
  g.clear();
  const L = layout().cell;
  const regionMap = computeRegions(scenario, walls);
  const roomToRegion = assignRoomsToRegions(placedPieces, regionMap);
  for (const [key, owner] of Object.entries(doors)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    const out = outwardByRegion(type, r, c, roomToRegion.get(owner), regionMap.cellToRegion);
    drawSwingArc(g, type, r, c, L, COL_DOOR, DOOR_WIDTH, out);
  }
}

/** Player windows — blue, opening outward (toward the outdoor side). */
export function drawWindows(g: Graphics, windows: Record<string, true>, scenario: Scenario) {
  g.clear();
  const L = layout().cell;
  const isIndoor = makeIsIndoor(scenario);
  for (const key of Object.keys(windows)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    drawSwingArc(g, type, r, c, L, COL_WINDOW, WIN_WIDTH, outwardByTerrain(type, r, c, isIndoor));
  }
}

/** Pre-drawn scenario doors — same swing symbol, pre-printed colour. */
function drawPreDrawnDoors(
  g: Graphics, doors: PreDrawnDoor[], L: number, isIndoor: (r: number, c: number) => boolean,
) {
  for (const d of doors) {
    const [r, c] = d.cell;
    let type: string, er: number, ec: number;
    if      (d.edge === 'N') { type = 'h'; er = r;     ec = c; }
    else if (d.edge === 'S') { type = 'h'; er = r + 1; ec = c; }
    else if (d.edge === 'W') { type = 'v'; er = r;     ec = c; }
    else                       { type = 'v'; er = r;     ec = c + 1; }
    drawSwingArc(g, type, er, ec, L, COL_PREDRAWN, DOOR_WIDTH, outwardByTerrain(type, er, ec, isIndoor));
  }
}

/**
 * Draw pre-drawn scenario elements (doors, windows, interior walls, markers).
 * These are "printed on the map" — they appear at scene load and cannot be
 * modified by the player.
 */
export function drawPreDrawn(g: Graphics, scenario: Scenario) {
  g.clear();
  const pd = scenario.pre_drawn;
  if (!pd) return;

  const L = layout().cell;
  const isIndoor = makeIsIndoor(scenario);

  // Pre-drawn interior walls — same colour as player walls but thinner.
  if (pd.walls_interior?.length) {
    g.strokeColor = COL_WALL;
    g.lineWidth = WALL_WIDTH - 1;
    for (const [r1, c1, r2, c2] of pd.walls_interior) {
      g.moveTo(edgeX(c1), edgeY(r1));
      g.lineTo(edgeX(c2), edgeY(r2));
    }
    g.stroke();
  }

  // Pre-drawn doors — swing symbol in pre-drawn colour.
  if (pd.doors?.length) {
    drawPreDrawnDoors(g, pd.doors, L, isIndoor);
  }

  // Pre-drawn windows — blue swing symbol, opening outward.
  if (pd.windows?.length) {
    for (const win of pd.windows) {
      const [r, c] = win.cell;
      const edge = win.edge;
      if (!edge) continue;
      let type: string, er: number, ec: number;
      if      (edge === 'N') { type = 'h'; er = r;     ec = c; }
      else if (edge === 'S') { type = 'h'; er = r + 1; ec = c; }
      else if (edge === 'W') { type = 'v'; er = r;     ec = c; }
      else                     { type = 'v'; er = r;     ec = c + 1; }
      drawSwingArc(g, type, er, ec, L, COL_WINDOW, WIN_WIDTH, outwardByTerrain(type, er, ec, isIndoor));
    }
  }

  // Pre-drawn markers — small filled circle at cell centre.
  if (pd.markers?.length) {
    const R = Math.min(L * 0.3, 14);
    g.fillColor = new Color(20, 30, 50, 200);
    g.strokeColor = COL_WALL;
    g.lineWidth = 2;
    for (const m of pd.markers) {
      const [r, c] = m.cell;
      const cx = edgeX(c) + L / 2;
      const cy = edgeY(r) - L / 2;
      g.circle(cx, cy, R);
      g.fill();
      g.stroke();
    }
  }
}
