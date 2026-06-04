import { Graphics, Color } from 'cc';
import type { Scenario, PreDrawnDoor, RoomSlot } from '../core/types';
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

/**
 * Draw player-placed doors as an architectural arc symbol (45° panel +
 * quarter-circle sweep arc) instead of the old circle stub.
 */
export function drawDoors(g: Graphics, doors: Record<string, RoomSlot>) {
  g.clear();
  const L = layout().cell;
  for (const key of Object.keys(doors)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    drawDoorArc(g, type, r, c, L, COL_DOOR, DOOR_WIDTH);
  }
}

/**
 * Draw the pre-drawn scenario doors with the same arc symbol but in a
 * slightly different colour so they look "pre-printed" rather than player-drawn.
 */
function drawPreDrawnDoors(g: Graphics, doors: PreDrawnDoor[], L: number) {
  for (const d of doors) {
    const [r, c] = d.cell;
    let type: string, er: number, ec: number;
    if      (d.edge === 'N') { type = 'h'; er = r;     ec = c; }
    else if (d.edge === 'S') { type = 'h'; er = r + 1; ec = c; }
    else if (d.edge === 'W') { type = 'v'; er = r;     ec = c; }
    else                       { type = 'v'; er = r;     ec = c + 1; }
    drawDoorArc(g, type, er, ec, L, COL_PREDRAWN, DOOR_WIDTH);
  }
}

function drawDoorArc(
  g: Graphics,
  type: string,
  r: number,
  c: number,
  L: number,
  color: Color,
  lineW: number,
) {
  g.strokeColor = color;
  g.lineWidth = lineW;

  if (type === 'h') {
    // Hinge at left endpoint of horizontal edge (Cocos coords).
    const hingeX = edgeX(c);
    const hingeY = edgeY(r);
    // Door panel: 45° angled downward (swings into room below, -y in Cocos).
    const panelAngle = -Math.PI / 4;
    const openX = hingeX + L * Math.cos(panelAngle);
    const openY = hingeY + L * Math.sin(panelAngle);
    g.moveTo(hingeX, hingeY);
    g.lineTo(openX, openY);
    g.stroke();
    g.arc(hingeX, hingeY, L, 0, panelAngle, true);
    g.stroke();
  } else {
    // Vertical edge: hinge at top endpoint.
    const hingeX = edgeX(c);
    const hingeY = edgeY(r);
    const closedAngle = -Math.PI / 2;   // downward
    const openAngle   = -Math.PI / 4;   // down-right at 45°
    const openX = hingeX + L * Math.cos(openAngle);
    const openY = hingeY + L * Math.sin(openAngle);
    g.moveTo(hingeX, hingeY);
    g.lineTo(openX, openY);
    g.stroke();
    g.arc(hingeX, hingeY, L, closedAngle, openAngle, false);
    g.stroke();
  }
}

export function drawWindows(g: Graphics, windows: Record<string, true>) {
  g.clear();
  g.strokeColor = COL_WINDOW;
  g.lineWidth = WIN_WIDTH;
  for (const key of Object.keys(windows)) {
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

  // Pre-drawn interior walls — same navy colour as player walls but thinner.
  if (pd.walls_interior?.length) {
    g.strokeColor = COL_WALL;
    g.lineWidth = WALL_WIDTH - 1;
    for (const [r1, c1, r2, c2] of pd.walls_interior) {
      g.moveTo(edgeX(c1), edgeY(r1));
      g.lineTo(edgeX(c2), edgeY(r2));
    }
    g.stroke();
  }

  // Pre-drawn doors — arc symbol in pre-drawn navy.
  if (pd.doors?.length) {
    drawPreDrawnDoors(g, pd.doors, L);
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
        g.moveTo(edgeX(c),     edgeY(ey));
        g.lineTo(edgeX(c + 1), edgeY(ey));
      } else {
        const ex = edge === 'W' ? c : c + 1;
        g.moveTo(edgeX(ex), edgeY(r));
        g.lineTo(edgeX(ex), edgeY(r + 1));
      }
    }
    g.stroke();
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
