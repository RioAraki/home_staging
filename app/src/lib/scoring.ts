// End-game scoring per RULES.md §"End of the game and final scoring".

import type { Scenario, RoomSlot, BonusPoint } from '../types';
import type { PlacedPiece } from '../store/game';
import { cardByNumberVariant } from '../data';
import { transformOption, absoluteCells } from './geometry';
import {
  analyseAccessibility,
  analyseOpenSpaceAccessibility,
  isRoomAccessible,
  pathDistance,
} from './regions';
import { checkWallEdgeCompliance } from './walls';
import { transformOption as transformOptionFn, absoluteCells as absoluteCellsFn } from './geometry';

export interface RoomScore {
  slot: RoomSlot;
  name_zh: string;
  occupiedSquares: number;          // raw squares from all placed pieces
  countedSquares: number;           // squares actually counted (after accessibility)
  pieceCount: number;
  validPieceCount: number;
  empty: boolean;
  accessible: boolean;              // whole room reachable from outside
}

export interface BonusEvaluation {
  text_zh: string;
  text_en: string;
  points: number;
  earned: boolean;
  evaluator: string;
}

export interface ScoreBreakdown {
  rooms: RoomScore[];
  totalSquares: number;
  emptyRoomPenalty: number;
  inaccessibleRooms: RoomSlot[];
  inaccessiblePenalty: number;
  bonuses: BonusEvaluation[];
  bonusTotal: number;
  total: number;
  doorIssues: string[];
  pieceIssues: string[];
  notes: string[];
}

function squaresPerPiece(p: PlacedPiece): number {
  const card = cardByNumberVariant(p.number, p.variant);
  const opt = card?.options.find((o) => o.option_index === p.optionIndex);
  if (!opt) return 0;
  const t = transformOption(opt, p.rotation, p.mirrored);
  return absoluteCells(t.shape, p.origin).filter(
    ([r, c]) => r >= 0 && c >= 0 && r < 16 && c < 16,
  ).length;
}

// Furniture numbers used by structural evaluators.
const TABLE_NUMBERS = new Set([4, 5]);    // dining tables + small tables
const PLANT_NUMBERS = new Set([19]);      // plants/florals

/** Composite pieces can advertise that they include another card's
 *  functionality via cell_features (e.g. #8B opt2 "toilet with shelf"
 *  tags the shelf cell). This maps the standalone furniture number that
 *  bonuses target to the cell_features tag that means "this composite
 *  contains one". Add entries here as new composite tags are introduced. */
const FEATURE_FOR_NUMBER: Record<number, string> = {
  3: 'shelf',
  19: 'plant',
};

/** Substring of the option's name_zh that flags a composite as carrying
 *  one of `target`'s functionality. Per the rulebook, "any card whose
 *  title contains 置物架 counts as a shelf for the 置物架(3) bonus". This
 *  is the simple, robust check — no per-cell tagging needed for new
 *  composite cards as long as the name is honest. */
const NAME_SUBSTRING_FOR_NUMBER: Record<number, string> = {
  3: '置物架',
};

/** True iff this placed piece should count toward "furniture #N" bonuses —
 *  either because its card IS #N, or because it's a composite carrying the
 *  feature equivalent of #N (via cell_features tag, OR by name substring
 *  match — whichever is simpler for the rule in question). */
function pieceCountsAsFurniture(p: PlacedPiece, target: number): boolean {
  if (p.number === target) return true;
  const card = cardByNumberVariant(p.number, p.variant);
  const opt = card?.options.find((o) => o.option_index === p.optionIndex);
  if (!opt) return false;
  const feature = FEATURE_FOR_NUMBER[target];
  if (feature && opt.cell_features?.some(([, , t]) => t === feature)) return true;
  const sub = NAME_SUBSTRING_FOR_NUMBER[target];
  if (sub && opt.name_zh.includes(sub)) return true;
  return false;
}

/** All world-cell occupancy from shape cells of a placed piece. */
function pieceShapeCells(p: PlacedPiece): Array<[number, number]> {
  const card = cardByNumberVariant(p.number, p.variant);
  const opt = card?.options.find((o) => o.option_index === p.optionIndex);
  if (!opt) return [];
  const t = transformOptionFn(opt, p.rotation, p.mirrored);
  return absoluteCellsFn(t.shape, p.origin);
}

/** Every cell the placed piece "occupies" on the card — its shape cells
 *  plus its open-space cells. Distance-style rules treat this as the
 *  piece's full footprint so e.g. the drum kit's cymbal hat counts the
 *  same as the surrounding stool-radius open cells. */
function pieceFootprintCells(p: PlacedPiece): Array<[number, number]> {
  const card = cardByNumberVariant(p.number, p.variant);
  const opt = card?.options.find((o) => o.option_index === p.optionIndex);
  if (!opt) return [];
  const t = transformOptionFn(opt, p.rotation, p.mirrored);
  return [
    ...absoluteCellsFn(t.shape, p.origin),
    ...absoluteCellsFn(t.open_spaces, p.origin),
  ];
}

function pieceOpenSpaceCells(p: PlacedPiece): Array<[number, number]> {
  const card = cardByNumberVariant(p.number, p.variant);
  const opt = card?.options.find((o) => o.option_index === p.optionIndex);
  if (!opt) return [];
  const t = transformOptionFn(opt, p.rotation, p.mirrored);
  return absoluteCellsFn(t.open_spaces, p.origin);
}

/** World-cell coordinates of cell_features on a placed piece whose type
 *  matches `featureType` (e.g. 'plant', 'table'). cell_features are
 *  bbox-local and already rotated / mirrored by transformOption. */
function pieceFeatureCells(p: PlacedPiece, featureType: string): Array<[number, number]> {
  const card = cardByNumberVariant(p.number, p.variant);
  const opt = card?.options.find((o) => o.option_index === p.optionIndex);
  if (!opt) return [];
  const t = transformOptionFn(opt, p.rotation, p.mirrored);
  const [or, oc] = p.origin;
  return t.cell_features
    .filter(([, , type]) => type === featureType)
    .map(([r, c]) => [r + or, c + oc] as [number, number]);
}

export interface EvaluatorContext {
  walls: Record<string, true>;
  doors: Record<string, RoomSlot>;
  windows?: Record<string, true>;
}

export function evaluateBonusCondition(
  bp: BonusPoint,
  scenario: Scenario,
  placedPieces: PlacedPiece[],
  ctx?: EvaluatorContext,
): { earned: boolean; evaluator: string; note?: string; count?: number } {
  const cond = bp.condition ?? {};
  const keys = Object.keys(cond);
  if (keys.length === 0) return { earned: false, evaluator: '(no condition)' };
  const key = keys[0];
  const arg = (cond as Record<string, Record<string, unknown>>)[key];
  switch (key) {
    case 'all_installed_in_room': {
      const slot = arg.room_slot as RoomSlot;
      const required = (arg.furniture as number[]) ?? [];
      const placedInRoom = new Set(
        placedPieces.filter((p) => p.roomSlot === slot).map((p) => p.number),
      );
      const missing = required.filter((n) => !placedInRoom.has(n));
      return {
        earned: missing.length === 0,
        evaluator: key,
        note: missing.length === 0
          ? `all ${required.length} required cards placed in room ${slot}`
          : `missing in room ${slot}: ${missing.map((n) => `#${n}`).join(', ')}`,
      };
    }
    case 'count_installed': {
      const f = arg.furniture as number;
      const min = (arg.min as number) ?? 1;
      const matched = placedPieces.filter((p) => pieceCountsAsFurniture(p, f));
      const composites = matched.filter((p) => p.number !== f).length;
      return {
        earned: matched.length >= min,
        evaluator: key,
        note: composites > 0
          ? `${matched.length}/${min} (incl. ${composites} composite)`
          : `${matched.length}/${min}`,
      };
    }
    case 'count_installed_in_room': {
      const slot = arg.room_slot as RoomSlot;
      const f = arg.furniture as number;
      const min = (arg.min as number) ?? 1;
      const matched = placedPieces.filter(
        (p) => p.roomSlot === slot && pieceCountsAsFurniture(p, f),
      );
      const composites = matched.filter((p) => p.number !== f).length;
      return {
        earned: matched.length >= min,
        evaluator: key,
        note: composites > 0
          ? `${matched.length}/${min} in room ${slot} (incl. ${composites} composite)`
          : `${matched.length}/${min} in room ${slot}`,
      };
    }
    case 'all_installed': {
      const required = (arg.furniture as number[]) ?? [];
      const placedNums = placedPieces.map((p) => p.number);
      return { earned: required.every((n) => placedNums.includes(n)), evaluator: key };
    }
    case 'at_least_one_per_card': {
      const cards = (arg.cards as number[]) ?? [];
      const placedNums = new Set(placedPieces.map((p) => p.number));
      return { earned: cards.every((n) => placedNums.has(n)), evaluator: key };
    }

    // ────────── Castle cafe / 城堡咖啡 ──────────
    case 'chairs_in_room_min': {
      // Count "chair" cells = open_space cells of all pieces in that room.
      // Prefer the option's explicit `chair_count` field when set (review
      // UI can override / correct it). Falls back to the original
      // heuristic of `open_spaces.length` per piece, which is right for
      // most dining furniture but wrong for any piece with non-seat
      // open spaces. Set chair_count on cards in the review UI to fix
      // discrepancies.
      const slot = arg.room_slot as RoomSlot;
      const min = (arg.min as number) ?? 1;
      let chairs = 0;
      for (const p of placedPieces) {
        if (p.roomSlot !== slot) continue;
        const card = cardByNumberVariant(p.number, p.variant);
        const opt = card?.options.find((o) => o.option_index === p.optionIndex);
        chairs += opt?.chair_count ?? pieceOpenSpaceCells(p).length;
      }
      return { earned: chairs >= min, evaluator: key, note: `${chairs} chairs counted` };
    }

    case 'per_table_adjacent_to_plant': {
      // +1 per table piece (#4 / #5) that has a plant cell 4-adjacent to
      // any of its shape cells. Plant cells come from two sources:
      //   - shape cells of standalone plant pieces (#19), and
      //   - cells tagged `plant` via cell_features on composite pieces
      //     (e.g. #5A opt1 "small table with plant" — the plant cell is at
      //     bbox-local [1,1]).
      // A composite piece naturally credits itself (one of its table-side
      // shape cells touches its own plant cell) AND lets neighbouring
      // tables score off the same plant cell.
      // Per-match scoring: caller multiplies bp.points by `count`.
      const tables = placedPieces.filter((p) => TABLE_NUMBERS.has(p.number));
      const plantCells = new Set<string>();
      for (const p of placedPieces) {
        if (PLANT_NUMBERS.has(p.number)) {
          for (const [r, c] of pieceShapeCells(p)) plantCells.add(`${r},${c}`);
        }
        for (const [wr, wc] of pieceFeatureCells(p, 'plant')) {
          plantCells.add(`${wr},${wc}`);
        }
      }
      let matched = 0;
      for (const t of tables) {
        for (const [r, c] of pieceShapeCells(t)) {
          const neighbours = [`${r - 1},${c}`, `${r + 1},${c}`, `${r},${c - 1}`, `${r},${c + 1}`];
          if (neighbours.some((nk) => plantCells.has(nk))) { matched++; break; }
        }
      }
      return {
        earned: matched > 0,
        count: matched,
        evaluator: key,
        note: `${matched} table(s) adjacent to a plant`,
      };
    }

    // ────────── Barn rehearsal ──────────
    case 'each_distance_at_most': {
      // For each pair (instrument piece, target piece), the shortest grid
      // path (4-neighbour, walls block) between ANY pair of cells the
      // pieces occupy (shape ∪ open_spaces — the full card footprint)
      // must be ≤ max. Bonus earned iff every pair satisfies.
      if (!ctx) return { earned: false, evaluator: key, note: 'walls context missing' };
      const instrumentNum = arg.instrument as number;
      const targets = (arg.targets as number[]) ?? [];
      const max = (arg.max as number) ?? 1;
      const sources = placedPieces.filter((p) => p.number === instrumentNum);
      const targetPieces = placedPieces.filter((p) => targets.includes(p.number));
      if (sources.length === 0 || targetPieces.length === 0) {
        return { earned: false, evaluator: key, note: 'instrument or target missing' };
      }
      for (const src of sources) {
        for (const tgt of targetPieces) {
          let best: number | null = null;
          for (const sc of pieceFootprintCells(src)) {
            for (const tc of pieceFootprintCells(tgt)) {
              const d = pathDistance(scenario, ctx.walls, sc, tc);
              if (d === null) continue;
              if (best === null || d < best) best = d;
            }
          }
          if (best === null || best > max) {
            return { earned: false, evaluator: key, note: `dist ${src.number}↔${tgt.number} = ${best ?? '∞'}` };
          }
        }
      }
      return { earned: true, evaluator: key };
    }

    // ────────── Mountain surgery ──────────
    case 'room_shape_square_and_max_doors': {
      // Room region cells form a perfect filled rectangle with rows == cols,
      // and the room has at most `max_doors` doors associated with it.
      if (!ctx) return { earned: false, evaluator: key, note: 'walls context missing' };
      const slot = arg.room_slot as RoomSlot;
      const maxDoors = (arg.max_doors as number) ?? 1;
      // Find a placed piece in this room to seed region detection
      const seed = placedPieces.find((p) => p.roomSlot === slot);
      if (!seed) return { earned: false, evaluator: key, note: 'no pieces in room' };
      const access = analyseAccessibility(scenario, placedPieces, ctx.walls, ctx.doors, null);
      const regId = access.roomToRegion.get(slot);
      if (regId === undefined) return { earned: false, evaluator: key, note: 'region not found' };
      const cells = access.regionMap.cellsByRegion.get(regId) ?? [];
      if (cells.length === 0) return { earned: false, evaluator: key };
      // Compute bbox of region
      let rMin = Infinity, rMax = -Infinity, cMin = Infinity, cMax = -Infinity;
      const cellSet = new Set(cells);
      for (const k of cells) {
        const [rs, cs] = k.split(',');
        const r = parseInt(rs, 10), c = parseInt(cs, 10);
        if (r < rMin) rMin = r; if (r > rMax) rMax = r;
        if (c < cMin) cMin = c; if (c > cMax) cMax = c;
      }
      const h = rMax - rMin + 1;
      const w = cMax - cMin + 1;
      const isFilledRect = h * w === cells.length;
      const isSquare = h === w;
      const doorCount = Object.values(ctx.doors).filter((s) => s === slot).length;
      return {
        earned: isFilledRect && isSquare && doorCount <= maxDoors,
        evaluator: key,
        note: `region ${h}×${w}, filled=${isFilledRect}, doors=${doorCount}`,
      };
    }

    case 'door_distance_between_rooms_max': {
      // Walk from one room's door (hallway side) to the other room's door
      // (hallway side), using the BFS path distance helper (4-neighbour,
      // walls block). Bonus earned iff distance ≤ max.
      if (!ctx) return { earned: false, evaluator: key, note: 'walls context missing' };
      const roomA = arg.room_a as RoomSlot;
      const roomB = arg.room_b as RoomSlot;
      const max = (arg.max as number) ?? 1;
      const access = analyseAccessibility(scenario, placedPieces, ctx.walls, ctx.doors, null);
      const hallwaySideForRoom = (slot: RoomSlot): [number, number] | null => {
        const roomReg = access.roomToRegion.get(slot);
        for (const [edgeKey, owner] of Object.entries(ctx.doors)) {
          if (owner !== slot) continue;
          const [type, rStr, cStr] = edgeKey.split(':');
          const r = parseInt(rStr, 10);
          const c = parseInt(cStr, 10);
          const sideA: [number, number] = type === 'h' ? [r - 1, c] : [r, c - 1];
          const sideB: [number, number] = type === 'h' ? [r, c] : [r, c];
          const regA = access.regionMap.cellToRegion.get(`${sideA[0]},${sideA[1]}`);
          const regB = access.regionMap.cellToRegion.get(`${sideB[0]},${sideB[1]}`);
          if (regA === roomReg) return sideB;
          if (regB === roomReg) return sideA;
        }
        return null;
      };
      const a = hallwaySideForRoom(roomA);
      const b = hallwaySideForRoom(roomB);
      if (!a) return { earned: false, evaluator: key, note: `room ${roomA} has no door yet` };
      if (!b) return { earned: false, evaluator: key, note: `room ${roomB} has no door yet` };
      const d = pathDistance(scenario, ctx.walls, a, b);
      if (d === null) {
        return { earned: false, evaluator: key, note: `doors not connected (need walkable path ≤ ${max})` };
      }
      return {
        earned: d <= max,
        evaluator: key,
        note: `door-to-door distance = ${d} (need ≤ ${max})`,
      };
    }

    case 'room_has_window_facing': {
      // A window on an exterior wall of the target room's region, where the
      // exterior side faces the requested compass direction. For a horizontal
      // edge `h:r:c`: cells (r-1,c) above and (r,c) below.
      //   direction = N → exterior (outdoor) is ABOVE, indoor BELOW → room cell (r,c)
      //   direction = S → exterior BELOW, indoor ABOVE → room cell (r-1,c)
      //   direction = W → exterior LEFT, indoor RIGHT → room cell (r,c) for v:r:c
      //   direction = E → exterior RIGHT, indoor LEFT → room cell (r,c-1) for v:r:c
      if (!ctx) return { earned: false, evaluator: key, note: 'walls context missing' };
      const wins = ctx.windows ?? {};
      if (Object.keys(wins).length === 0) {
        return { earned: false, evaluator: key, note: 'no windows drawn' };
      }
      const slot = arg.room_slot as RoomSlot;
      const direction = (arg.direction as string)?.toUpperCase();
      // Determine which cells belong to the target room region.
      const access = analyseAccessibility(scenario, placedPieces, ctx.walls, ctx.doors, null);
      const regId = access.roomToRegion.get(slot);
      if (regId === undefined) {
        return { earned: false, evaluator: key, note: 'room has no placed pieces' };
      }
      const roomCells = new Set(access.regionMap.cellsByRegion.get(regId) ?? []);
      const grid = scenario.grid;
      const rows = grid.ascii.replace(/\n+$/, '').split('\n');
      const isIndoor = (r: number, c: number) =>
        r >= 0 && c >= 0 && r < rows.length && c < (rows[r]?.length ?? 0) &&
        grid.legend[rows[r][c]]?.terrain === 'indoor';
      for (const edgeKey of Object.keys(wins)) {
        const [type, rStr, cStr] = edgeKey.split(':');
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        let indoorCell: [number, number] | null = null;
        let dir: string | null = null;
        if (type === 'h') {
          // window faces N if outdoor is above (r-1,c) and indoor is below (r,c)
          if (!isIndoor(r - 1, c) && isIndoor(r, c)) {
            indoorCell = [r, c]; dir = 'N';
          } else if (isIndoor(r - 1, c) && !isIndoor(r, c)) {
            indoorCell = [r - 1, c]; dir = 'S';
          }
        } else {
          if (!isIndoor(r, c - 1) && isIndoor(r, c)) {
            indoorCell = [r, c]; dir = 'W';
          } else if (isIndoor(r, c - 1) && !isIndoor(r, c)) {
            indoorCell = [r, c - 1]; dir = 'E';
          }
        }
        if (!indoorCell || !dir) continue;
        if (dir !== direction) continue;
        if (!roomCells.has(`${indoorCell[0]},${indoorCell[1]}`)) continue;
        return { earned: true, evaluator: key, note: `window facing ${dir} found` };
      }
      return {
        earned: false,
        evaluator: key,
        note: `no ${direction}-facing window in this room`,
      };
    }

    case 'covers_marker': {
      // Bonus: a placed piece of `furniture` (e.g. counter #30) must have
      // at least one shape cell overlapping the marker cell identified by
      // `marker` (id from scenario.pre_drawn.markers). Used by Game Store
      // for the "counter covers the socket" bonus.
      const furnitureNum = arg.furniture as number;
      const markerId = arg.marker as string;
      const markers = scenario.pre_drawn?.markers ?? [];
      const target = markers.find((m) => m.id === markerId);
      if (!target) {
        return { earned: false, evaluator: key, note: `marker ${markerId} not in scenario data` };
      }
      const [mr, mc] = target.cell;
      const candidates = placedPieces.filter((p) => p.number === furnitureNum);
      if (candidates.length === 0) {
        return { earned: false, evaluator: key, note: `#${furnitureNum} not placed` };
      }
      const covered = candidates.some((p) =>
        pieceShapeCells(p).some(([r, c]) => r === mr && c === mc),
      );
      return {
        earned: covered,
        evaluator: key,
        note: covered
          ? `#${furnitureNum} covers ${markerId}`
          : `#${furnitureNum} placed but not over ${markerId}`,
      };
    }

    default:
      return { earned: false, evaluator: `${key} (not implemented)` };
  }
}

export function computeScore(
  scenario: Scenario,
  placedPieces: PlacedPiece[],
  walls: Record<string, true>,
  doors: Record<string, RoomSlot>,
  frontDoorEdge: string | null,
  windows: Record<string, true> = {},
): ScoreBreakdown {
  const access = analyseAccessibility(scenario, placedPieces, walls, doors, frontDoorEdge);
  const pieceAccess = analyseOpenSpaceAccessibility(scenario, placedPieces, walls, doors, access, frontDoorEdge);
  const wallEdgeCompliance = checkWallEdgeCompliance(scenario, placedPieces, walls, doors);
  const wallEdgeViolators = new Set(wallEdgeCompliance.violations.map((v) => v.pieceIndex));

  // Per-piece counts and grouping. A piece counts only if:
  //   - its open spaces are reachable from its room's door (pieceAccess)
  //   - its wall_edges are backed by walls (wallEdgeCompliance)
  //   - its room is reachable from outside via the front door + door graph
  //     (building-level connectivity — checked here, not inside pieceAccess)
  const validPieceFlags = placedPieces.map((p, idx) => {
    if (!pieceAccess.validPieceIndices.has(idx)) return false;
    if (wallEdgeViolators.has(idx)) return false;
    if (!isRoomAccessible(access, p.roomSlot)) return false;
    return true;
  });
  const pieceSquares = placedPieces.map(squaresPerPiece);

  const rooms: RoomScore[] = scenario.rooms.map((room) => {
    let occupied = 0;
    let counted = 0;
    let pieces = 0;
    let validPieces = 0;
    placedPieces.forEach((p, idx) => {
      if (p.roomSlot !== room.slot) return;
      pieces += 1;
      occupied += pieceSquares[idx];
      if (validPieceFlags[idx]) {
        validPieces += 1;
        counted += pieceSquares[idx];
      }
    });
    return {
      slot: room.slot,
      name_zh: room.name_zh,
      occupiedSquares: occupied,
      countedSquares: counted,
      pieceCount: pieces,
      validPieceCount: validPieces,
      empty: pieces === 0,
      accessible: isRoomAccessible(access, room.slot),
    };
  });

  const totalSquares = rooms.reduce((s, r) => s + r.countedSquares, 0);
  const droppedSquares = rooms.reduce((s, r) => s + (r.occupiedSquares - r.countedSquares), 0);

  const emptyRoomPenalty = -3 * rooms.filter((r) => r.empty).length;
  const inaccessibleRooms = rooms.filter((r) => !r.empty && !r.accessible).map((r) => r.slot);

  const bonuses: BonusEvaluation[] = scenario.bonus_points.map((bp) => {
    const { earned, evaluator, count } = evaluateBonusCondition(bp, scenario, placedPieces, { walls, doors, windows });
    // Per-match scoring: when an evaluator returns `count` (e.g.
    // per_table_adjacent_to_plant returning how many tables matched),
    // multiply the YAML's points value by that count. Otherwise fall back
    // to the boolean earned check.
    const points = count !== undefined ? bp.points * count : earned ? bp.points : 0;
    return {
      text_zh: bp.text_zh,
      text_en: bp.text_en,
      points,
      earned,
      evaluator,
    };
  });
  const bonusTotal = bonuses.reduce((s, b) => s + b.points, 0);

  const doorIssues = access.doorIssues.map((d) => `Room ${d.roomSlot}: ${d.reason}`);
  const pieceIssues: string[] = [];
  for (const [slot, msgs] of pieceAccess.ignoredReasons) {
    for (const m of msgs) pieceIssues.push(`Room ${slot}: ${m}`);
  }
  for (const v of wallEdgeCompliance.violations) {
    const tail =
      v.doorOnRequired.length > 0
        ? 'door placed on bold edge (not allowed there)'
        : `missing wall on ${v.missing.length} required segment(s)`;
    pieceIssues.push(`Wall-edge: ${v.pieceLabel} — ${tail}`);
  }

  const notes: string[] = [];
  if (access.frontDoorIssue) {
    notes.push(access.frontDoorIssue);
  }
  if (access.hallwayRegions.size === 0) {
    notes.push('No hallway region detected — rooms may not be reachable from outside.');
  }
  if (droppedSquares > 0) {
    notes.push(`${droppedSquares} square(s) of furniture were dropped because their open space(s) are not reachable from the room's door.`);
  }

  return {
    rooms,
    totalSquares,
    emptyRoomPenalty,
    inaccessibleRooms,
    inaccessiblePenalty: -droppedSquares,
    bonuses,
    bonusTotal,
    total: totalSquares + emptyRoomPenalty + bonusTotal,
    doorIssues,
    pieceIssues,
    notes,
  };
}
