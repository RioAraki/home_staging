import { Graphics, Color } from 'cc';
import type { Scenario, CellAttrs, PreDrawnDoor } from '../core/types';

export const CELL_SIZE = 40;
export const GRID_ROWS = 16;
export const GRID_COLS = 16;

// ── Design tokens (translated from React blueprint aesthetic) ─────────────────
// React app lives on a dark navy background; the Cocos port uses a light cream
// background instead (easier to read on mobile). Colours below are tuned for
// that light-paper look.
const COL_INDOOR   = new Color(245, 240, 225, 255);  // warm cream paper
const COL_OUTDOOR  = new Color(181, 213, 168, 255);  // soft muted green
const COL_WATER    = new Color(150, 180, 220, 255);
const COL_ROAD     = new Color(180, 180, 180, 255);
const COL_OBSTACLE = new Color(100, 100, 100, 255);

const COL_GRIDLINE = new Color(80, 80, 90, 160);     // visible blueprint pencil
const COL_WALL     = new Color(30,  40,  60,  255);  // navy — architectural pen
const COL_DOOR     = new Color(200, 140,  30, 255);  // warm golden — matches accent
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

  // Fill cells by terrain.
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const ch = ascii[r]?.[c] ?? '.';
      const attrs: CellAttrs | undefined = legend[ch];
      const color = fillColorFor(attrs?.terrain);
      g.fillColor = color;
      // Cocos UI: y axis points UP, so we flip rows.
      const x = c * CELL_SIZE - (GRID_COLS * CELL_SIZE) / 2;
      const y = -(r * CELL_SIZE) + (GRID_ROWS * CELL_SIZE) / 2 - CELL_SIZE;
      g.rect(x, y, CELL_SIZE, CELL_SIZE);
      g.fill();
    }
  }

  // Grid lines — very faint to mirror the blueprint's 0.6-px light cyan lines.
  g.strokeColor = COL_GRIDLINE;
  g.lineWidth = 1;
  const W = GRID_COLS * CELL_SIZE;
  const H = GRID_ROWS * CELL_SIZE;
  for (let i = 0; i <= GRID_COLS; i++) {
    const x = i * CELL_SIZE - W / 2;
    g.moveTo(x, -H / 2);
    g.lineTo(x, H / 2);
  }
  for (let i = 0; i <= GRID_ROWS; i++) {
    const y = i * CELL_SIZE - H / 2;
    g.moveTo(-W / 2, y);
    g.lineTo(W / 2, y);
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

import type { RoomSlot } from '../core/types';

export function drawWalls(g: Graphics, walls: Record<string, true>) {
  g.clear();
  g.strokeColor = COL_WALL;
  g.lineWidth = WALL_WIDTH;
  const W = GRID_COLS * CELL_SIZE, H = GRID_ROWS * CELL_SIZE;
  for (const key of Object.keys(walls)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    if (type === 'h') {
      g.moveTo(c * CELL_SIZE - W / 2,       H / 2 - r * CELL_SIZE);
      g.lineTo((c + 1) * CELL_SIZE - W / 2, H / 2 - r * CELL_SIZE);
    } else {
      g.moveTo(c * CELL_SIZE - W / 2, H / 2 - r * CELL_SIZE);
      g.lineTo(c * CELL_SIZE - W / 2, H / 2 - (r + 1) * CELL_SIZE);
    }
  }
  g.stroke();
}

/**
 * Draw player-placed doors as an architectural arc symbol (45° panel +
 * quarter-circle sweep arc) instead of the old circle stub.
 *
 * For h-edges the door swings downward (positive y in Cocos = up, so visually
 * below the wall line). For v-edges it swings rightward. This is a consistent
 * "always swing into room below/right" heuristic — good enough for v1.
 */
export function drawDoors(g: Graphics, doors: Record<string, RoomSlot>) {
  g.clear();
  const W = GRID_COLS * CELL_SIZE, H = GRID_ROWS * CELL_SIZE;
  const L = CELL_SIZE;

  for (const key of Object.keys(doors)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    drawDoorArc(g, type, r, c, W, H, L, COL_DOOR, DOOR_WIDTH);
  }
}

/**
 * Draw the pre-drawn scenario doors with the same arc symbol but in a
 * slightly different colour so they look "pre-printed" rather than player-drawn.
 */
function drawPreDrawnDoors(g: Graphics, doors: PreDrawnDoor[], W: number, H: number) {
  const L = CELL_SIZE;
  for (const d of doors) {
    const [r, c] = d.cell;
    // Convert cell+edge to the edge key format used by the coordinate system.
    // pre_drawn.doors have a cell [r,c] and edge direction N/S/E/W.
    let type: string;
    let er: number;
    let ec: number;
    if (d.edge === 'N') { type = 'h'; er = r;     ec = c; }
    else if (d.edge === 'S') { type = 'h'; er = r + 1; ec = c; }
    else if (d.edge === 'W') { type = 'v'; er = r;     ec = c; }
    else                       { type = 'v'; er = r;     ec = c + 1; }
    drawDoorArc(g, type, er, ec, W, H, L, COL_PREDRAWN, DOOR_WIDTH);
  }
}

function drawDoorArc(
  g: Graphics,
  type: string,
  r: number,
  c: number,
  W: number,
  H: number,
  L: number,
  color: Color,
  lineW: number,
) {
  g.strokeColor = color;
  g.lineWidth = lineW;

  if (type === 'h') {
    // Hinge at left endpoint of horizontal edge (Cocos coords).
    const hingeX = c * L - W / 2;
    const hingeY = H / 2 - r * L;
    // Door panel: 45° angled downward (swings into room below, which is -y in Cocos).
    const panelAngle = -Math.PI / 4;   // -45° (downward in Cocos y-up space)
    const openX = hingeX + L * Math.cos(panelAngle);
    const openY = hingeY + L * Math.sin(panelAngle);
    // Panel line
    g.moveTo(hingeX, hingeY);
    g.lineTo(openX, openY);
    g.stroke();
    // Swing arc from horizontal (0°) to panel angle (-45°), i.e. CW
    // In Cocos, arc(cx, cy, r, startAngle, endAngle, anticlockwise)
    // startAngle = 0 (pointing right), endAngle = -PI/4, clockwise (not anticlockwise)
    g.arc(hingeX, hingeY, L, 0, panelAngle, true);
    g.stroke();
  } else {
    // Vertical edge: hinge at top endpoint.
    const hingeX = c * L - W / 2;
    const hingeY = H / 2 - r * L;
    // Door panel: 45° to the right (swings into room to the right).
    const panelAngle = -Math.PI / 4 - Math.PI / 2;  // -135° from +x = pointing down-right 45° from downward
    // Actually for v-edge: closed direction is straight down (-PI/2).
    // Open direction: 45° to right of downward = -PI/2 + PI/4 = -PI/4 (pointing down-right)
    // Simpler: closed is at angle -PI/2 (downward), open is at -PI/4 (lower-right at 45°)
    const closedAngle = -Math.PI / 2;
    const openAngle   = -Math.PI / 4;
    const openX = hingeX + L * Math.cos(openAngle);
    const openY = hingeY + L * Math.sin(openAngle);
    g.moveTo(hingeX, hingeY);
    g.lineTo(openX, openY);
    g.stroke();
    // Arc from closed (-PI/2) to open (-PI/4), counter-clockwise (angles increasing)
    g.arc(hingeX, hingeY, L, closedAngle, openAngle, false);
    g.stroke();
  }
}

export function drawWindows(g: Graphics, windows: Record<string, true>) {
  g.clear();
  g.strokeColor = COL_WINDOW;
  g.lineWidth = WIN_WIDTH;
  const W = GRID_COLS * CELL_SIZE, H = GRID_ROWS * CELL_SIZE;
  for (const key of Object.keys(windows)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    if (type === 'h') {
      const x1 = c * CELL_SIZE - W / 2;
      const x2 = (c + 1) * CELL_SIZE - W / 2;
      const y = H / 2 - r * CELL_SIZE;
      g.moveTo(x1, y); g.lineTo(x2, y);
    } else {
      const x = c * CELL_SIZE - W / 2;
      const y1 = H / 2 - r * CELL_SIZE;
      const y2 = H / 2 - (r + 1) * CELL_SIZE;
      g.moveTo(x, y1); g.lineTo(x, y2);
    }
  }
  g.stroke();
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

  const W = GRID_COLS * CELL_SIZE, H = GRID_ROWS * CELL_SIZE;

  // Pre-drawn interior walls — same navy colour as player walls but thinner.
  if (pd.walls_interior?.length) {
    g.strokeColor = COL_WALL;
    g.lineWidth = WALL_WIDTH - 1;  // 4px, slightly lighter than player walls (5px)
    for (const [r1, c1, r2, c2] of pd.walls_interior) {
      g.moveTo(c1 * CELL_SIZE - W / 2, H / 2 - r1 * CELL_SIZE);
      g.lineTo(c2 * CELL_SIZE - W / 2, H / 2 - r2 * CELL_SIZE);
    }
    g.stroke();
  }

  // Pre-drawn doors — arc symbol in pre-drawn navy.
  if (pd.doors?.length) {
    drawPreDrawnDoors(g, pd.doors, W, H);
  }

  // Pre-drawn windows — same light-blue as player windows.
  if (pd.windows?.length) {
    g.strokeColor = COL_WINDOW;
    g.lineWidth = WIN_WIDTH;
    for (const win of pd.windows) {
      const [r, c] = win.cell;
      const edge = win.edge;
      if (!edge) continue;
      if (edge === 'N' || edge === 'S') {
        const ey = edge === 'N' ? r : r + 1;
        const x1 = c * CELL_SIZE - W / 2;
        const x2 = (c + 1) * CELL_SIZE - W / 2;
        const y = H / 2 - ey * CELL_SIZE;
        g.moveTo(x1, y); g.lineTo(x2, y);
      } else {
        const ex = edge === 'W' ? c : c + 1;
        const x = ex * CELL_SIZE - W / 2;
        const y1 = H / 2 - r * CELL_SIZE;
        const y2 = H / 2 - (r + 1) * CELL_SIZE;
        g.moveTo(x, y1); g.lineTo(x, y2);
      }
    }
    g.stroke();
  }

  // Pre-drawn markers — small filled circle at cell centre.
  if (pd.markers?.length) {
    const R = Math.min(CELL_SIZE * 0.3, 14);
    g.fillColor = new Color(20, 30, 50, 200);
    g.strokeColor = COL_WALL;
    g.lineWidth = 2;
    for (const m of pd.markers) {
      const [r, c] = m.cell;
      const cx = (c + 0.5) * CELL_SIZE - W / 2;
      const cy = H / 2 - (r + 0.5) * CELL_SIZE;
      g.circle(cx, cy, R);
      g.fill();
      g.stroke();
    }
  }
}
