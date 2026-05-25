// Validation for player-drawn walls.
//
// "Continuous wall" rule: every player wall edge must be anchored at both
// endpoints. An endpoint is anchored when at least one OTHER wall edge
// (player-drawn or part of the exterior building outline) meets there.
//
// This catches stray / dangling walls — the building's interior walls must
// hook into the exterior wall (or other player walls) at both ends, not
// float in the middle of the room.
//
// Note: this is a necessary but not sufficient condition for closed-room
// topology. A snaking path connecting two exterior points would pass this
// check (and is arguably fine). Full enclosure of furniture by walls is a
// stricter check we may add later.

import type { Scenario, RoomSlot, WallEdge, WallEdgeSpec } from '../types';
import type { PlacedPiece } from '../store/game';
import { transformOption } from './geometry';
import { cardByNumberVariant } from '../data';

type Vertex = string;   // "r,c" — corner coordinate, 0 ≤ r,c ≤ 16
type EdgeKey = string;  // "h:r:c" or "v:r:c"

function vertexKey(r: number, c: number): Vertex {
  return `${r},${c}`;
}

function endpointsOfEdge(edgeKey: EdgeKey): [Vertex, Vertex] {
  const [type, rStr, cStr] = edgeKey.split(':');
  const r = parseInt(rStr, 10);
  const c = parseInt(cStr, 10);
  if (type === 'h') {
    return [vertexKey(r, c), vertexKey(r, c + 1)];
  }
  return [vertexKey(r, c), vertexKey(r + 1, c)];
}

export function exteriorWallEdges(scenario: Scenario): EdgeKey[] {
  const cells = scenario.grid.ascii.replace(/\n+$/, '').split('\n').map((r) => r.split(''));
  const legend = scenario.grid.legend;
  const isIndoor = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < cells.length && c < (cells[r]?.length ?? 0) &&
    legend[cells[r][c]]?.terrain === 'indoor';
  const out: EdgeKey[] = [];
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (!isIndoor(r, c)) continue;
      if (!isIndoor(r - 1, c)) out.push(`h:${r}:${c}`);
      if (!isIndoor(r + 1, c)) out.push(`h:${r + 1}:${c}`);
      if (!isIndoor(r, c - 1)) out.push(`v:${r}:${c}`);
      if (!isIndoor(r, c + 1)) out.push(`v:${r}:${c + 1}`);
    }
  }
  return out;
}

export interface WallTopologyResult {
  ok: boolean;
  danglingWalls: EdgeKey[];
}

/** Verify every player wall has both endpoints connected to at least one
 *  other wall (exterior or player). */
export function validateWallTopology(
  scenario: Scenario,
  playerWalls: Record<EdgeKey, true>,
): WallTopologyResult {
  // Build vertex degree map from exterior + player walls.
  const ext = exteriorWallEdges(scenario);
  const playerWallKeys = Object.keys(playerWalls);
  const allEdges: EdgeKey[] = [...ext, ...playerWallKeys];

  const degree = new Map<Vertex, number>();
  for (const e of allEdges) {
    const [a, b] = endpointsOfEdge(e);
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }

  const dangling: EdgeKey[] = [];
  for (const e of playerWallKeys) {
    const [a, b] = endpointsOfEdge(e);
    if ((degree.get(a) ?? 0) < 2 || (degree.get(b) ?? 0) < 2) {
      dangling.push(e);
    }
  }
  return { ok: dangling.length === 0, danglingWalls: dangling };
}

// ─────────────────────────────────────────────────────────────────────────────
// Wall-edge compliance
//
// Rulebook §"卡上的墙":
//   "某些家具的草图上一侧有一条加粗线——表示这一侧必须紧贴墙（内墙或外墙皆可）。
//    这堵墙可以与既有墙共用，但不能在这一段开门。"
//
// → A furniture option's `wall_edges` lists which bbox sides must abut a wall
//   (the bold edge on the printed card). The wall requirement applies to
//   every NON-VOID cell on that side — i.e. shape ∪ open_spaces, not shape
//   alone. (Island-style pieces like #30 the bar have the bar in the middle
//   and the open seating in front, so the OPEN cells are what abut the wall.)
//   Doors are disallowed on the required segment.
// ─────────────────────────────────────────────────────────────────────────────

export interface WallEdgeRequirement {
  edgeKey: EdgeKey;
  side: WallEdge;
}

/** Compute the list of grid edges that a placed piece needs to be walls.
 *
 *  Each `wallEdges` entry is either:
 *  - A bare side string ('top'|'bottom'|'left'|'right') — fans out to every
 *    non-void cell touching that bbox side. This is the common case.
 *  - A `[row, col, side]` tuple — emits one requirement for that specific
 *    cell + side, regardless of the bbox boundary. Used when the printed
 *    walls don't cover a full side. */
export function requiredWallEdgesForPiece(
  shape: [number, number][],
  openSpaces: [number, number][],
  bbox: [number, number],
  wallEdges: WallEdgeSpec[],
  origin: [number, number],
): WallEdgeRequirement[] {
  const [R0, C0] = origin;
  const [H, W] = bbox;
  const nonVoid = [...shape, ...openSpaces];
  const out: WallEdgeRequirement[] = [];
  const seen = new Set<EdgeKey>();
  const push = (edgeKey: EdgeKey, side: WallEdge) => {
    if (seen.has(edgeKey)) return;
    seen.add(edgeKey);
    out.push({ edgeKey, side });
  };
  const cellEdgeKey = (r: number, c: number, side: WallEdge): EdgeKey => {
    switch (side) {
      case 'top':    return `h:${R0 + r}:${C0 + c}`;
      case 'bottom': return `h:${R0 + r + 1}:${C0 + c}`;
      case 'left':   return `v:${R0 + r}:${C0 + c}`;
      case 'right':  return `v:${R0 + r}:${C0 + c + 1}`;
    }
  };
  for (const entry of wallEdges) {
    if (typeof entry === 'string') {
      const side = entry;
      for (const [r, c] of nonVoid) {
        if (
          (side === 'top' && r === 0) ||
          (side === 'bottom' && r === H - 1) ||
          (side === 'left' && c === 0) ||
          (side === 'right' && c === W - 1)
        ) {
          push(cellEdgeKey(r, c, side), side);
        }
      }
    } else {
      const [r, c, side] = entry;
      push(cellEdgeKey(r, c, side), side);
    }
  }
  return out;
}

export interface WallEdgeViolation {
  pieceIndex: number;
  pieceLabel: string;
  missing: WallEdgeRequirement[];
  /** Subset of missing where the edge is currently a door (the bold edge can
   *  never be a door per rule). */
  doorOnRequired: WallEdgeRequirement[];
}

export interface WallEdgeComplianceResult {
  ok: boolean;
  violations: WallEdgeViolation[];
}

/** Check every placed piece's wall_edges. If filterRoomSlot is given, only
 *  check pieces belonging to that room. */
export function checkWallEdgeCompliance(
  scenario: Scenario,
  placedPieces: PlacedPiece[],
  playerWalls: Record<EdgeKey, true>,
  playerDoors: Record<EdgeKey, RoomSlot>,
  filterRoomSlot?: RoomSlot,
): WallEdgeComplianceResult {
  const exteriorSet = new Set(exteriorWallEdges(scenario));
  const violations: WallEdgeViolation[] = [];

  placedPieces.forEach((p, idx) => {
    if (filterRoomSlot && p.roomSlot !== filterRoomSlot) return;
    const card = cardByNumberVariant(p.number, p.variant);
    const opt = card?.options.find((o) => o.option_index === p.optionIndex);
    if (!opt) return;
    if (!opt.wall_edges || opt.wall_edges.length === 0) return;
    const t = transformOption(opt, p.rotation, p.mirrored);
    const required = requiredWallEdgesForPiece(
      t.shape,
      t.open_spaces,
      t.bbox,
      t.wall_edges,
      p.origin,
    );
    const missing: WallEdgeRequirement[] = [];
    const doorOnReq: WallEdgeRequirement[] = [];
    for (const req of required) {
      if (playerDoors[req.edgeKey]) {
        // Doors are walls structurally, but the rule forbids a door on the
        // bold-edge segment. Flag separately so the UI message is precise.
        doorOnReq.push(req);
        missing.push(req);
        continue;
      }
      if (playerWalls[req.edgeKey]) continue;
      if (exteriorSet.has(req.edgeKey)) continue;
      missing.push(req);
    }
    if (missing.length > 0) {
      violations.push({
        pieceIndex: idx,
        pieceLabel: `#${p.number}${p.variant} ${opt.name_zh}`,
        missing,
        doorOnRequired: doorOnReq,
      });
    }
  });

  return { ok: violations.length === 0, violations };
}
