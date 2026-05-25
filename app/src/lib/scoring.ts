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

/** All world-cell occupancy from shape cells of a placed piece. */
function pieceShapeCells(p: PlacedPiece): Array<[number, number]> {
  const card = cardByNumberVariant(p.number, p.variant);
  const opt = card?.options.find((o) => o.option_index === p.optionIndex);
  if (!opt) return [];
  const t = transformOptionFn(opt, p.rotation, p.mirrored);
  return absoluteCellsFn(t.shape, p.origin);
}

function pieceOpenSpaceCells(p: PlacedPiece): Array<[number, number]> {
  const card = cardByNumberVariant(p.number, p.variant);
  const opt = card?.options.find((o) => o.option_index === p.optionIndex);
  if (!opt) return [];
  const t = transformOptionFn(opt, p.rotation, p.mirrored);
  return absoluteCellsFn(t.open_spaces, p.origin);
}

export interface EvaluatorContext {
  walls: Record<string, true>;
  doors: Record<string, RoomSlot>;
}

export function evaluateBonusCondition(
  bp: BonusPoint,
  scenario: Scenario,
  placedPieces: PlacedPiece[],
  ctx?: EvaluatorContext,
): { earned: boolean; evaluator: string; note?: string } {
  const cond = bp.condition ?? {};
  const keys = Object.keys(cond);
  if (keys.length === 0) return { earned: false, evaluator: '(no condition)' };
  const key = keys[0];
  const arg = (cond as Record<string, Record<string, unknown>>)[key];
  switch (key) {
    case 'all_installed_in_room': {
      const slot = arg.room_slot as RoomSlot;
      const required = (arg.furniture as number[]) ?? [];
      const placedInRoom = placedPieces.filter((p) => p.roomSlot === slot).map((p) => p.number);
      return { earned: required.every((n) => placedInRoom.includes(n)), evaluator: key };
    }
    case 'count_installed': {
      const f = arg.furniture as number;
      const min = (arg.min as number) ?? 1;
      return { earned: placedPieces.filter((p) => p.number === f).length >= min, evaluator: key };
    }
    case 'count_installed_in_room': {
      const slot = arg.room_slot as RoomSlot;
      const f = arg.furniture as number;
      const min = (arg.min as number) ?? 1;
      return {
        earned: placedPieces.filter((p) => p.roomSlot === slot && p.number === f).length >= min,
        evaluator: key,
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
      // Convention: every open_space cell in dining furniture (#4 #5)
      // represents a seat. This counts open spaces of any placed piece in
      // the room — for dining rooms this is overwhelmingly chairs.
      const slot = arg.room_slot as RoomSlot;
      const min = (arg.min as number) ?? 1;
      let chairs = 0;
      for (const p of placedPieces) {
        if (p.roomSlot !== slot) continue;
        chairs += pieceOpenSpaceCells(p).length;
      }
      return { earned: chairs >= min, evaluator: key, note: `${chairs} chairs counted` };
    }

    case 'per_table_adjacent_to_plant': {
      // +1 per table piece (#4 / #5) that has a plant (#19) in a cell
      // 4-adjacent to any of its shape cells. We DON'T currently feed the
      // earned count back as variable points — the bonus_points record uses a
      // fixed `points` value. For this scenario the rulebook awards +1 per
      // matched table; we approximate by treating earned = "at least one
      // matched table" (bonus is 1 point fixed in the YAML so it lines up).
      const tables = placedPieces.filter((p) => TABLE_NUMBERS.has(p.number));
      const plantCells = new Set<string>();
      for (const p of placedPieces) {
        if (PLANT_NUMBERS.has(p.number)) {
          for (const [r, c] of pieceShapeCells(p)) plantCells.add(`${r},${c}`);
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
        evaluator: key,
        note: `${matched} table(s) adjacent to a plant`,
      };
    }

    // ────────── Barn rehearsal ──────────
    case 'each_distance_at_most': {
      // For each pair (instrument piece, target piece), the shortest grid
      // path (4-neighbour, walls block) between any pair of shape cells must
      // be ≤ max. Bonus earned iff all pairs satisfy.
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
          for (const sc of pieceShapeCells(src)) {
            for (const tc of pieceShapeCells(tgt)) {
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

    case 'room_has_window_facing': {
      // Window-drawing UI is not implemented yet. Always not-earned.
      return { earned: false, evaluator: key, note: 'window system not implemented' };
    }

    case 'covers_marker': {
      // Scenario marker cells (e.g. socket markers) are not yet authored
      // into scenario data. Always not-earned for now.
      return { earned: false, evaluator: key, note: 'marker cells not in data' };
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
): ScoreBreakdown {
  const access = analyseAccessibility(scenario, placedPieces, walls, doors, frontDoorEdge);
  const pieceAccess = analyseOpenSpaceAccessibility(scenario, placedPieces, walls, doors, access);
  const wallEdgeCompliance = checkWallEdgeCompliance(scenario, placedPieces, walls, doors);
  const wallEdgeViolators = new Set(wallEdgeCompliance.violations.map((v) => v.pieceIndex));

  // Per-piece counts and grouping. A piece counts only if it passes BOTH
  // open-space accessibility AND wall-edge requirements.
  const validPieceFlags = placedPieces.map(
    (_, idx) => pieceAccess.validPieceIndices.has(idx) && !wallEdgeViolators.has(idx),
  );
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
    const { earned, evaluator } = evaluateBonusCondition(bp, scenario, placedPieces, { walls, doors });
    return {
      text_zh: bp.text_zh,
      text_en: bp.text_en,
      points: earned ? bp.points : 0,
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
