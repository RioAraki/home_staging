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
const COL_INDOOR   = new Color(255, 255, 255, 46);   // translucent white fill (~18% opacity)
const COL_OUTDOOR  = new Color(0,   0,   0,   72);   // dark overlay on non-playable border cells
const COL_WATER    = new Color(150, 180, 220, 255);
const COL_ROAD     = new Color(180, 180, 180, 255);
const COL_OBSTACLE = new Color(100, 100, 100, 255);

const COL_INDOOR_BORDER = new Color(255, 255, 255, 242);  // thick white outline
const COL_GRIDLINE = new Color(255, 255, 255, 100);  // white pencil, bolder for readability
const COL_WALL     = new Color(255, 255, 255, 235);  // white architectural line
const COL_DOOR     = new Color(255, 220,  90, 255);  // yellow room door
const COL_FRONT_DOOR = new Color(255, 170,  60, 255);  // orange building front door (大门)
const COL_WINDOW   = new Color(168, 216, 238, 255);  // #a8d8ee light blue
const COL_PREDRAWN = new Color(50,  60,  90,  200);  // slightly lighter navy

const WALL_WIDTH   = 5;
const DOOR_WIDTH   = 3;
const WIN_WIDTH    = 5;
// ─────────────────────────────────────────────────────────────────────────────

// Translucent red wash painted over every cell of a blocked / invalid room
// (e.g. its door opens into another room, breaking the "each room independent"
// rule) so the violation is impossible to miss. Ported from the web version's
// problem-room overlay (FloorPlan.tsx).
const COL_BLOCKED = new Color(255, 80, 80, 80);

/** Fill each "r,c" cell with a translucent wash (default: blocked-room red). */
export function drawCellWash(
  g: Graphics, cells: Iterable<string>, color: Color = COL_BLOCKED,
) {
  g.clear();
  const { cell } = layout();
  g.fillColor = color;
  let any = false;
  for (const k of cells) {
    const [rs, cs] = k.split(',');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    // edgeY(r) is the top of the cell; bottom-left corner is edgeY(r)-cell.
    g.rect(edgeX(c), edgeY(r) - cell, cell, cell);
    any = true;
  }
  if (any) g.fill();
}

/** Build a Color from a scenario theme RGB triple, or fall back to a default. */
function themeColor(rgb: [number, number, number] | undefined, fallback: Color): Color {
  return Array.isArray(rgb) && rgb.length === 3
    ? new Color(rgb[0], rgb[1], rgb[2], fallback.a)
    : fallback;
}

/** Resolve a scenario's wall color (themed or default COL_WALL). Used by FloorPlan. */
export function wallColorFor(scenario: Scenario | null | undefined): Color {
  return themeColor(scenario?.theme?.wall, COL_WALL);
}

const luminance = (c: Color): number => (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;

/** A color that contrasts with `bg`: its inverse hue, or pure black/white when the
 *  inverse would sit too close in luminance (a mid-tone bg whose inverse is also mid-tone). */
function contrastColor(bg: Color): Color {
  const inv = new Color(255 - bg.r, 255 - bg.g, 255 - bg.b, 255);
  if (Math.abs(luminance(bg) - luminance(inv)) < 0.25) {
    return luminance(bg) > 0.5 ? new Color(0, 0, 0, 255) : new Color(255, 255, 255, 255);
  }
  return inv;
}

/** Open-cell dot color: auto-derived contrast of the (themed or default) background,
 *  so the dots stay visible on any background. Keeps the dot's existing translucency. */
export function openCellDotColor(scenario: Scenario | null | undefined): Color {
  const c = contrastColor(themeColor(scenario?.theme?.bg, COL_BG));
  return new Color(c.r, c.g, c.b, 120);
}

export function drawGridBg(
  g: Graphics, scenario: Scenario, frontDoorEdge: string | null = null,
) {
  g.clear();

  const ascii = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
  const legend = scenario.grid.legend;
  const { cell, r0, c0, rows, cols, w, h } = layout();

  const theme = scenario.theme;
  const bgColor = themeColor(theme?.bg, COL_BG);
  const gridColor = themeColor(theme?.gridline, COL_GRIDLINE);

  // 1) Fill the entire crop area with the navy blueprint canvas.
  g.fillColor = bgColor;
  g.rect(edgeX(c0), edgeY(r0 + rows), w, h);
  g.fill();

  // 2) Overlay cells: outdoor border cells get a dark wash; indoor/special get
  //    a translucent white fill so the playable area is clearly brighter.
  for (let r = r0; r < r0 + rows; r++) {
    for (let c = c0; c < c0 + cols; c++) {
      const ch = ascii[r]?.[c] ?? '.';
      const terrain = legend[ch]?.terrain;
      if (terrain === 'indoor' || terrain === 'water' ||
          terrain === 'road' || terrain === 'obstacle') {
        g.fillColor = fillColorFor(terrain);
      } else {
        g.fillColor = COL_OUTDOOR;   // non-indoor border cells are visibly darker
      }
      g.rect(edgeX(c), edgeY(r) - cell, cell, cell);
      g.fill();
    }
  }

  // 3) Faint white grid lines.
  g.strokeColor = gridColor;
  g.lineWidth = 2;
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
  // The thick exterior outline used to be drawn here too, but it must sit ABOVE
  // the furniture (so furniture never bleeds over a wall). It now lives on its
  // own layer — see drawIndoorBorder, called into FloorPlan's wallOutlineLayer.
}

/**
 * Thick exterior outline: for each indoor cell, stroke any side whose neighbour
 * is not indoor — tracing the floor-plan outline exactly, even for non-rectangular
 * rooms. The front-door edge is skipped so the door symbol shows through a real
 * gap in the wall. Drawn on its OWN layer (above the furniture) so walls always
 * read on top of furniture where their pixels overlap.
 */
export function drawIndoorBorder(
  g: Graphics, scenario: Scenario, frontDoorEdge: string | null = null,
) {
  g.clear();
  const ascii = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
  const legend = scenario.grid.legend;
  const { r0, c0, rows, cols } = layout();
  const isIndoor = (r: number, c: number): boolean => {
    if (r < r0 || c < c0 || r >= r0 + rows || c >= c0 + cols) return false;
    const ch = ascii[r]?.[c] ?? '.';
    return legend[ch]?.terrain === 'indoor';
  };

  g.strokeColor = themeColor(scenario.theme?.wall, COL_INDOOR_BORDER);
  g.lineWidth = 5;
  for (let r = r0; r < r0 + rows; r++) {
    for (let c = c0; c < c0 + cols; c++) {
      if (!isIndoor(r, c)) continue;
      if (!isIndoor(r - 1, c) && frontDoorEdge !== `h:${r}:${c}`) {  // top
        g.moveTo(edgeX(c),     edgeY(r));
        g.lineTo(edgeX(c + 1), edgeY(r));
      }
      if (!isIndoor(r + 1, c) && frontDoorEdge !== `h:${r + 1}:${c}`) {  // bottom
        g.moveTo(edgeX(c),     edgeY(r + 1));
        g.lineTo(edgeX(c + 1), edgeY(r + 1));
      }
      if (!isIndoor(r, c - 1) && frontDoorEdge !== `v:${r}:${c}`) {  // left
        g.moveTo(edgeX(c), edgeY(r));
        g.lineTo(edgeX(c), edgeY(r + 1));
      }
      if (!isIndoor(r, c + 1) && frontDoorEdge !== `v:${r}:${c + 1}`) {  // right
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

export function drawWalls(
  g: Graphics, walls: Record<string, true>,
  activeColor: Color = COL_WALL, doors: Record<string, RoomSlot> = {},
  lockedWalls: Set<string> = new Set(), lockedColor: Color = COL_WALL,
) {
  g.clear();
  const seg = (key: string) => {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    if (type === 'h') {
      g.moveTo(edgeX(c),     edgeY(r));
      g.lineTo(edgeX(c + 1), edgeY(r));
    } else {
      g.moveTo(edgeX(c), edgeY(r));
      g.lineTo(edgeX(c), edgeY(r + 1));
    }
  };
  // A door is an opening — the wall is gone there.
  const visible = Object.keys(walls).filter((k) => !doors[k]);
  // Locked walls (sealed rooms) take the (themed) wall base color.
  g.strokeColor = lockedColor;
  g.lineWidth = WALL_WIDTH;
  for (const key of visible) if (lockedWalls.has(key)) seg(key);
  g.stroke();
  // Active walls take the phase/enclosure colour.
  g.strokeColor = activeColor;
  g.lineWidth = WALL_WIDTH;
  for (const key of visible) if (!lockedWalls.has(key)) seg(key);
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
 * One swing leaf hinged at (hx,hy): a solid panel of length `L` at `open`, plus
 * a DASHED arc sweeping from `closed` to `open`.
 */
function drawSwingFromHinge(
  g: Graphics, hx: number, hy: number, L: number,
  closed: number, open: number, color: Color, panelW: number, arcW: number,
) {
  g.strokeColor = color;
  g.lineWidth = panelW;
  g.moveTo(hx, hy);
  g.lineTo(hx + L * Math.cos(open), hy + L * Math.sin(open));
  g.stroke();
  g.lineWidth = arcW;
  const steps = 10;
  for (let i = 0; i < steps; i += 2) {
    const t0 = closed + (open - closed) * (i / steps);
    const t1 = closed + (open - closed) * ((i + 1) / steps);
    g.moveTo(hx + L * Math.cos(t0), hy + L * Math.sin(t0));
    g.lineTo(hx + L * Math.cos(t1), hy + L * Math.sin(t1));
  }
  g.stroke();
}

/** Single-leaf door, opening outward. Panel is wall-thick (the door fills the
 *  wall opening), arc thinner. */
function drawDoorSymbol(g: Graphics, type: string, r: number, c: number, L: number, color: Color, outward: Outward) {
  if (type === 'h') {
    const closed = 0;
    const open = outward === 'up' ? Math.PI / 4 : -Math.PI / 4;
    drawSwingFromHinge(g, edgeX(c), edgeY(r), L, closed, open, color, WALL_WIDTH, DOOR_WIDTH - 1);
  } else {
    const closed = -Math.PI / 2;
    const open = outward === 'right' ? -Math.PI / 4 : -3 * Math.PI / 4;
    drawSwingFromHinge(g, edgeX(c), edgeY(r), L, closed, open, color, WALL_WIDTH, DOOR_WIDTH - 1);
  }
}

/** Double-leaf (casement) window: two leaves hinged at the edge's endpoints,
 *  each swinging exactly 45° outward (so the arc never wraps the long way). */
function drawWindowSymbol(g: Graphics, type: string, r: number, c: number, L: number, color: Color, outward: Outward) {
  const half = L / 2;
  const Q = Math.PI / 4;
  const arcW = 2;
  if (type === 'h') {
    const y = edgeY(r), x1 = edgeX(c), x2 = edgeX(c + 1);
    const s = outward === 'up' ? 1 : -1;              // swing direction in +y
    // left leaf closed along +x (0); right leaf closed along -x (π).
    drawSwingFromHinge(g, x1, y, half, 0, s * Q, color, WIN_WIDTH, arcW);
    drawSwingFromHinge(g, x2, y, half, Math.PI, Math.PI - s * Q, color, WIN_WIDTH, arcW);
  } else {
    const x = edgeX(c), y1 = edgeY(r), y2 = edgeY(r + 1);
    const s = outward === 'right' ? 1 : -1;           // swing direction in +x
    // top leaf closed along -y (-π/2); bottom leaf closed along +y (π/2).
    drawSwingFromHinge(g, x, y1, half, -Math.PI / 2, -Math.PI / 2 + s * Q, color, WIN_WIDTH, arcW);
    drawSwingFromHinge(g, x, y2, half, Math.PI / 2, Math.PI / 2 - s * Q, color, WIN_WIDTH, arcW);
  }
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

/** Player doors — yellow, opening outward (away from the owning room). The
 *  building's front door (大门) is drawn here too, in orange, swinging out
 *  toward the outdoors — it sits in the gap drawGridBg leaves in the exterior
 *  wall. */
export function drawDoors(
  g: Graphics, doors: Record<string, RoomSlot>,
  scenario: Scenario, walls: Record<string, true>, placedPieces: PlacedPiece[],
  frontDoorEdge: string | null = null,
) {
  g.clear();
  const L = layout().cell;
  const doorColor = themeColor(scenario.theme?.door, COL_DOOR);
  const frontDoorColor = themeColor(scenario.theme?.front_door, COL_FRONT_DOOR);
  const regionMap = computeRegions(scenario, walls);
  const roomToRegion = assignRoomsToRegions(placedPieces, regionMap);
  for (const [key, owner] of Object.entries(doors)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    const out = outwardByRegion(type, r, c, roomToRegion.get(owner), regionMap.cellToRegion);
    drawDoorSymbol(g, type, r, c, L, doorColor, out);
  }
  if (frontDoorEdge) {
    const isIndoor = makeIsIndoor(scenario);
    const [type, rs, cs] = frontDoorEdge.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    drawDoorSymbol(g, type, r, c, L, frontDoorColor, outwardByTerrain(type, r, c, isIndoor));
  }
}

/** Player windows — blue, double-leaf, opening outward (toward the outdoor side). */
export function drawWindows(g: Graphics, windows: Record<string, true>, scenario: Scenario) {
  g.clear();
  const L = layout().cell;
  const winColor = themeColor(scenario.theme?.window, COL_WINDOW);
  const isIndoor = makeIsIndoor(scenario);
  for (const key of Object.keys(windows)) {
    const [type, rs, cs] = key.split(':');
    const r = parseInt(rs, 10), c = parseInt(cs, 10);
    drawWindowSymbol(g, type, r, c, L, winColor, outwardByTerrain(type, r, c, isIndoor));
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
    drawDoorSymbol(g, type, er, ec, L, COL_PREDRAWN, outwardByTerrain(type, er, ec, isIndoor));
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

  // NOTE: pre_drawn.walls_interior is NOT drawn here. initRun seeds those
  // edges into the `walls` state (locked), so drawWalls paints them along
  // with every other wall — one code path, one appearance. The old block
  // here drew each entry as a line between two *cell* coordinates, which
  // rendered vertical edges as horizontal strokes; it never showed because
  // no shipped scenario used the field.

  // Pre-drawn doors — swing symbol in pre-drawn colour.
  if (pd.doors?.length) {
    drawPreDrawnDoors(g, pd.doors, L, isIndoor);
  }

  // Pre-drawn windows — blue swing symbol, opening outward.
  if (pd.windows?.length) {
    const winColor = themeColor(scenario.theme?.window, COL_WINDOW);
    for (const win of pd.windows) {
      const [r, c] = win.cell;
      const edge = win.edge;
      if (!edge) continue;
      let type: string, er: number, ec: number;
      if      (edge === 'N') { type = 'h'; er = r;     ec = c; }
      else if (edge === 'S') { type = 'h'; er = r + 1; ec = c; }
      else if (edge === 'W') { type = 'v'; er = r;     ec = c; }
      else                     { type = 'v'; er = r;     ec = c + 1; }
      drawWindowSymbol(g, type, er, ec, L, winColor, outwardByTerrain(type, er, ec, isIndoor));
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
