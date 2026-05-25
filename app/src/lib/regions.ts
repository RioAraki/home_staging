// Region detection + accessibility analysis.
//
// A "region" is a maximal connected component of indoor cells where movement
// between adjacent cells is allowed unless blocked by a wall edge. The cells
// outside the building are NOT a region (we treat them as the abstract
// "OUTSIDE" node in the accessibility graph).
//
// For accessibility:
//   1. Compute regions (walls block, including walls that are also doors).
//   2. Group placed pieces by region.
//   3. Each room's region = the region containing its placed pieces (or null
//      if the room has no placed pieces, e.g. skipped).
//   4. The "hallway" region = a region with no placed pieces. We assume the
//      hallway is the access point to OUTSIDE (implicit front door on its
//      exterior wall — explicit front-door UI deferred).
//   5. Build a graph: regions are nodes, each door connects the two regions
//      on either side of its edge.
//   6. From OUTSIDE → hallway → BFS through doors → set of reachable regions.
//   7. A room is "accessible" iff its region is reachable.

import type { Scenario, RoomSlot } from '../types';
import type { PlacedPiece } from '../store/game';
import { transformOption, absoluteCells } from './geometry';
import { cardByNumberVariant } from '../data';

export type CellKey = string;        // "r,c"
export type RegionId = number;
export type EdgeKey = string;

export interface RegionMap {
  cellToRegion: Map<CellKey, RegionId>;
  regions: Set<RegionId>;
  /** For each region, the set of cells it contains. */
  cellsByRegion: Map<RegionId, CellKey[]>;
}

function indoorCells(scenario: Scenario): CellKey[] {
  const rows = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
  const out: CellKey[] = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (scenario.grid.legend[ch]?.terrain === 'indoor') {
        out.push(`${r},${c}`);
      }
    }
  }
  return out;
}

/** Is the edge between cells (r1,c1) and (r2,c2) blocked by a wall in `walls`? */
function isBlocked(
  r1: number, c1: number, r2: number, c2: number,
  walls: Record<string, true>,
): boolean {
  // Always-adjacent assumption: |dr|+|dc|=1
  if (r1 === r2 && c1 + 1 === c2) {
    // edge to the right of (r1,c1) === left of (r1,c2) → v:r1:c2
    return !!walls[`v:${r1}:${c2}`];
  }
  if (r1 === r2 && c1 - 1 === c2) {
    return !!walls[`v:${r1}:${c1}`];
  }
  if (c1 === c2 && r1 + 1 === r2) {
    return !!walls[`h:${r2}:${c1}`];
  }
  if (c1 === c2 && r1 - 1 === r2) {
    return !!walls[`h:${r1}:${c1}`];
  }
  return true;
}

export function computeRegions(
  scenario: Scenario,
  walls: Record<string, true>,
): RegionMap {
  const cells = new Set(indoorCells(scenario));
  const cellToRegion = new Map<CellKey, RegionId>();
  const cellsByRegion = new Map<RegionId, CellKey[]>();
  let nextId = 0;

  for (const start of cells) {
    if (cellToRegion.has(start)) continue;
    const id = nextId++;
    const queue: CellKey[] = [start];
    cellToRegion.set(start, id);
    const bag: CellKey[] = [];
    while (queue.length) {
      const k = queue.shift()!;
      bag.push(k);
      const [rs, cs] = k.split(',');
      const r = parseInt(rs, 10);
      const c = parseInt(cs, 10);
      const neighbours: Array<[number, number]> = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
      ];
      for (const [nr, nc] of neighbours) {
        const nk = `${nr},${nc}`;
        if (!cells.has(nk)) continue;
        if (cellToRegion.has(nk)) continue;
        if (isBlocked(r, c, nr, nc, walls)) continue;
        cellToRegion.set(nk, id);
        queue.push(nk);
      }
    }
    cellsByRegion.set(id, bag);
  }
  return { cellToRegion, regions: new Set(cellsByRegion.keys()), cellsByRegion };
}

/** Cells on either side of a wall edge. Both may be out of bounds → null entries. */
function edgeSides(edgeKey: EdgeKey): [[number, number], [number, number]] {
  const [type, rStr, cStr] = edgeKey.split(':');
  const r = parseInt(rStr, 10);
  const c = parseInt(cStr, 10);
  if (type === 'h') {
    // horizontal edge between (r-1, c) and (r, c)
    return [[r - 1, c], [r, c]];
  }
  // vertical between (r, c-1) and (r, c)
  return [[r, c - 1], [r, c]];
}

export interface RoomAssignment {
  roomSlot: RoomSlot;
  regionId: RegionId | null;       // null if no pieces placed
}

export function assignRoomsToRegions(
  placedPieces: PlacedPiece[],
  regions: RegionMap,
): Map<RoomSlot, RegionId> {
  const m = new Map<RoomSlot, RegionId>();
  for (const p of placedPieces) {
    if (m.has(p.roomSlot)) continue;
    const card = cardByNumberVariant(p.number, p.variant);
    const opt = card?.options.find((o) => o.option_index === p.optionIndex);
    if (!opt) continue;
    const t = transformOption(opt, p.rotation, p.mirrored);
    const cells = absoluteCells(t.shape, p.origin);
    for (const [r, c] of cells) {
      const k = `${r},${c}`;
      const reg = regions.cellToRegion.get(k);
      if (reg !== undefined) { m.set(p.roomSlot, reg); break; }
    }
  }
  return m;
}

export interface AccessibilityResult {
  regionMap: RegionMap;
  roomToRegion: Map<RoomSlot, RegionId>;
  hallwayRegions: Set<RegionId>;        // regions containing no placed pieces
  outsideAccessible: Set<RegionId>;     // regions reachable from OUTSIDE
  doorIssues: Array<{ edgeKey: EdgeKey; reason: string; roomSlot: RoomSlot }>;
  frontDoorIssue: string | null;
}

export function analyseAccessibility(
  scenario: Scenario,
  placedPieces: PlacedPiece[],
  walls: Record<string, true>,
  doors: Record<EdgeKey, RoomSlot>,
  frontDoorEdge: string | null,
): AccessibilityResult {
  const regionMap = computeRegions(scenario, walls);
  const roomToRegion = assignRoomsToRegions(placedPieces, regionMap);
  const usedRegions = new Set<RegionId>(Array.from(roomToRegion.values()));
  const hallwayRegions = new Set<RegionId>();
  for (const id of regionMap.regions) {
    if (!usedRegions.has(id)) hallwayRegions.add(id);
  }

  // Build door-graph: for each door, identify the regions on its two sides.
  // "OUTSIDE" is region id -1.
  const OUTSIDE: RegionId = -1;
  const adjacency = new Map<RegionId, Set<RegionId>>();
  const addEdge = (a: RegionId, b: RegionId) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  const doorIssues: AccessibilityResult['doorIssues'] = [];

  for (const [edgeKey, owner] of Object.entries(doors)) {
    const sides = edgeSides(edgeKey);
    const sideRegions = sides.map(([r, c]) => {
      const key = `${r},${c}`;
      const reg = regionMap.cellToRegion.get(key);
      return reg === undefined ? OUTSIDE : reg;
    });
    addEdge(sideRegions[0], sideRegions[1]);
    // Door must lead from the owner-room region to a DIFFERENT region.
    const ownerReg = roomToRegion.get(owner);
    if (ownerReg === undefined) {
      doorIssues.push({
        edgeKey, roomSlot: owner,
        reason: `Room ${owner} has no placed pieces — cannot tell where its region is.`,
      });
      continue;
    }
    const [a, b] = sideRegions;
    if (a !== ownerReg && b !== ownerReg) {
      doorIssues.push({
        edgeKey, roomSlot: owner,
        reason: `Room ${owner}'s door is not on its own region's boundary.`,
      });
    } else if (a === b && a !== OUTSIDE) {
      doorIssues.push({
        edgeKey, roomSlot: owner,
        reason: `Room ${owner}'s door has the same region on both sides (not separating anything).`,
      });
    }
  }

  // Front door: the player must designate ONE exterior-wall edge as the front
  // door. OUTSIDE connects only via that edge to the indoor region on its
  // interior side.
  let frontDoorIssue: string | null = null;
  if (!frontDoorEdge) {
    frontDoorIssue = 'No front door designated — the building has no entrance from outside.';
  } else {
    const sides = edgeSides(frontDoorEdge);
    const sideRegions = sides.map(([r, c]) => {
      const key = `${r},${c}`;
      const reg = regionMap.cellToRegion.get(key);
      return reg === undefined ? OUTSIDE : reg;
    });
    const indoorSide = sideRegions.find((id) => id !== OUTSIDE);
    const outdoorSide = sideRegions.find((id) => id === OUTSIDE);
    if (indoorSide === undefined || outdoorSide === undefined) {
      frontDoorIssue =
        'Front door is not on an exterior wall (both sides must be indoor↔outdoor).';
    } else {
      addEdge(OUTSIDE, indoorSide);
    }
  }

  // BFS from OUTSIDE
  const outsideAccessible = new Set<RegionId>();
  const queue: RegionId[] = [OUTSIDE];
  const seen = new Set<RegionId>([OUTSIDE]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur !== OUTSIDE) outsideAccessible.add(cur);
    const adj = adjacency.get(cur);
    if (!adj) continue;
    for (const n of adj) {
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }

  return {
    regionMap,
    roomToRegion,
    hallwayRegions,
    outsideAccessible,
    doorIssues,
    frontDoorIssue,
  };
}

export function isRoomAccessible(
  result: AccessibilityResult,
  slot: RoomSlot,
): boolean {
  const reg = result.roomToRegion.get(slot);
  if (reg === undefined) return false;
  return result.outsideAccessible.has(reg);
}

/** Shortest 4-neighbour grid path between two cells, blocked by walls (and
 *  doors, which are walls structurally). Returns null if unreachable. Only
 *  walks through indoor cells. */
export function pathDistance(
  scenario: Scenario,
  walls: Record<string, true>,
  from: [number, number],
  to: [number, number],
): number | null {
  const indoor = new Set(indoorCells(scenario));
  const fromKey = `${from[0]},${from[1]}`;
  const toKey = `${to[0]},${to[1]}`;
  if (!indoor.has(fromKey) || !indoor.has(toKey)) return null;
  if (fromKey === toKey) return 0;
  const dist = new Map<string, number>([[fromKey, 0]]);
  const queue: string[] = [fromKey];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === toKey) return dist.get(cur)!;
    const [rs, cs] = cur.split(',');
    const r = parseInt(rs, 10);
    const c = parseInt(cs, 10);
    const d = dist.get(cur)!;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as Array<[number, number]>) {
      const nk = `${nr},${nc}`;
      if (!indoor.has(nk) || dist.has(nk)) continue;
      if (isBlocked(r, c, nr, nc, walls)) continue;
      dist.set(nk, d + 1);
      if (nk === toKey) return d + 1;
      queue.push(nk);
    }
  }
  return null;
}

// ─────────────────── Per-piece open-space accessibility ───────────────────
//
// RULES.md: "Open spaces must be connected. Pieces of furniture whose open
// spaces are not entirely accessible will be ignored during scoring!"
//
// For each placed piece, every one of its open-space cells must be reachable
// from the room's door (interior side) by walking only on cells that are
// either empty, open-space cells, or part of the carpet (#33) which is a
// special exception.

const CARPET_NUMBER = 31;  // NOTE: per FURNITURE.md the carpet is #33 in the
                            // rulebook numbering. Update if your data differs.

function getShapeCellsByPiece(
  placedPieces: PlacedPiece[],
): { byPieceIdx: Map<number, Set<string>>; carpetCells: Set<string>; allBlockingCells: Set<string> } {
  const byPieceIdx = new Map<number, Set<string>>();
  const carpetCells = new Set<string>();
  const allBlockingCells = new Set<string>();
  placedPieces.forEach((p, idx) => {
    const card = cardByNumberVariant(p.number, p.variant);
    const opt = card?.options.find((o) => o.option_index === p.optionIndex);
    if (!opt) return;
    const t = transformOption(opt, p.rotation, p.mirrored);
    const set = new Set<string>();
    for (const [r, c] of absoluteCells(t.shape, p.origin)) {
      const k = `${r},${c}`;
      set.add(k);
      if (p.number === CARPET_NUMBER || p.number === 33) {
        // Carpet is walkable — not a blocker
        carpetCells.add(k);
      } else {
        allBlockingCells.add(k);
      }
    }
    byPieceIdx.set(idx, set);
  });
  return { byPieceIdx, carpetCells, allBlockingCells };
}

function getOpenSpaceCellsByPiece(placedPieces: PlacedPiece[]): Map<number, Set<string>> {
  const m = new Map<number, Set<string>>();
  placedPieces.forEach((p, idx) => {
    const card = cardByNumberVariant(p.number, p.variant);
    const opt = card?.options.find((o) => o.option_index === p.optionIndex);
    if (!opt) return;
    const t = transformOption(opt, p.rotation, p.mirrored);
    const set = new Set<string>();
    for (const [r, c] of absoluteCells(t.open_spaces, p.origin)) {
      set.add(`${r},${c}`);
    }
    m.set(idx, set);
  });
  return m;
}

/** For a given room, find the cell on the room side of the room's door. */
function findRoomDoorCell(
  doors: Record<string, RoomSlot>,
  regionMap: RegionMap,
  roomToRegion: Map<RoomSlot, RegionId>,
  slot: RoomSlot,
): string | null {
  const roomReg = roomToRegion.get(slot);
  if (roomReg === undefined) return null;
  for (const [edgeKey, owner] of Object.entries(doors)) {
    if (owner !== slot) continue;
    const sides = edgeSides(edgeKey);
    for (const [r, c] of sides) {
      const k = `${r},${c}`;
      if (regionMap.cellToRegion.get(k) === roomReg) return k;
    }
  }
  return null;
}

export interface PieceAccessibility {
  /** indices into placedPieces of pieces whose open spaces are fully reachable */
  validPieceIndices: Set<number>;
  /** indices into placedPieces of pieces that are ignored at scoring */
  ignoredPieceIndices: Set<number>;
  /** per-room reasons (e.g. "door not found", "open spaces unreachable: piece X") */
  ignoredReasons: Map<RoomSlot, string[]>;
}

export function analyseOpenSpaceAccessibility(
  scenario: Scenario,
  placedPieces: PlacedPiece[],
  walls: Record<string, true>,
  doors: Record<string, RoomSlot>,
  access: AccessibilityResult,
): PieceAccessibility {
  const valid = new Set<number>();
  const ignored = new Set<number>();
  const reasons = new Map<RoomSlot, string[]>();
  const pushReason = (slot: RoomSlot, msg: string) => {
    const arr = reasons.get(slot) ?? [];
    arr.push(msg);
    reasons.set(slot, arr);
  };

  const { allBlockingCells } = getShapeCellsByPiece(placedPieces);
  const openByIdx = getOpenSpaceCellsByPiece(placedPieces);

  // Group piece indices by room
  const piecesByRoom = new Map<RoomSlot, number[]>();
  placedPieces.forEach((p, idx) => {
    const list = piecesByRoom.get(p.roomSlot) ?? [];
    list.push(idx);
    piecesByRoom.set(p.roomSlot, list);
  });

  for (const [slot, pieceIdxs] of piecesByRoom) {
    const roomReg = access.roomToRegion.get(slot);
    if (roomReg === undefined) {
      for (const idx of pieceIdxs) ignored.add(idx);
      pushReason(slot, 'room region not detected');
      continue;
    }
    if (!access.outsideAccessible.has(roomReg)) {
      for (const idx of pieceIdxs) ignored.add(idx);
      pushReason(slot, 'room not reachable from outside');
      continue;
    }
    const doorCell = findRoomDoorCell(doors, access.regionMap, access.roomToRegion, slot);
    if (!doorCell) {
      for (const idx of pieceIdxs) ignored.add(idx);
      pushReason(slot, 'door not on room boundary');
      continue;
    }
    // BFS from door cell across walkable cells inside the room region.
    const regionCells = new Set(access.regionMap.cellsByRegion.get(roomReg) ?? []);
    const walkable = (k: string) => regionCells.has(k) && !allBlockingCells.has(k);
    if (!walkable(doorCell)) {
      for (const idx of pieceIdxs) ignored.add(idx);
      pushReason(slot, 'door cell blocked by furniture');
      continue;
    }
    const reached = new Set<string>([doorCell]);
    const queue = [doorCell];
    while (queue.length) {
      const cur = queue.shift()!;
      const [rs, cs] = cur.split(',');
      const r = parseInt(rs, 10);
      const c = parseInt(cs, 10);
      const neighbours: Array<[number, number]> = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
      ];
      for (const [nr, nc] of neighbours) {
        const nk = `${nr},${nc}`;
        if (reached.has(nk)) continue;
        if (!walkable(nk)) continue;
        // Check wall barrier between cells
        if (isBlocked(r, c, nr, nc, walls)) continue;
        reached.add(nk);
        queue.push(nk);
      }
    }
    for (const idx of pieceIdxs) {
      const opens = openByIdx.get(idx) ?? new Set();
      const allOk = Array.from(opens).every((k) => reached.has(k));
      if (allOk) {
        valid.add(idx);
      } else {
        ignored.add(idx);
        const card = cardByNumberVariant(placedPieces[idx].number, placedPieces[idx].variant);
        pushReason(slot, `Piece #${placedPieces[idx].number}${placedPieces[idx].variant} (${card?.options[0]?.name_zh ?? '?'}) has unreachable open space(s)`);
      }
    }
  }

  return { validPieceIndices: valid, ignoredPieceIndices: ignored, ignoredReasons: reasons };
}
