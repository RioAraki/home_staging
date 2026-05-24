// End-game scoring per RULES.md §"End of the game and final scoring".

import type { Scenario, RoomSlot, BonusPoint } from '../types';
import type { PlacedPiece } from '../store/game';
import { cardByNumberVariant } from '../data';
import { transformOption, absoluteCells } from './geometry';
import {
  analyseAccessibility,
  analyseOpenSpaceAccessibility,
  isRoomAccessible,
} from './regions';

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

function evaluateBonusCondition(
  bp: BonusPoint,
  _scenario: Scenario,
  placedPieces: PlacedPiece[],
): { earned: boolean; evaluator: string } {
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
    default:
      return { earned: false, evaluator: `${key} (not implemented)` };
  }
}

export function computeScore(
  scenario: Scenario,
  placedPieces: PlacedPiece[],
  walls: Record<string, true>,
  doors: Record<string, RoomSlot>,
): ScoreBreakdown {
  const access = analyseAccessibility(scenario, placedPieces, walls, doors);
  const pieceAccess = analyseOpenSpaceAccessibility(scenario, placedPieces, walls, doors, access);

  // Per-piece counts and grouping
  const validPieceFlags = placedPieces.map((_, idx) => pieceAccess.validPieceIndices.has(idx));
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
    const { earned, evaluator } = evaluateBonusCondition(bp, scenario, placedPieces);
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

  const notes: string[] = [];
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
