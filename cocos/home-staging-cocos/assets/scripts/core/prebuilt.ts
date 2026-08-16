// Scenarios that ship a finished floor plan.
//
// Most levels start as one empty indoor blob: the player draws the interior
// walls and cuts the doors. A scenario can instead hand those over pre-built
// via `pre_drawn.walls_interior` / `pre_drawn.doors`, leaving the player only
// the furniture. The early tutorial levels use this to teach "what a room
// looks like" before asking anyone to draw one.
//
// initRun seeds the walls into the run state AND marks them locked, so the
// given layout cannot be demolished.

import type { Scenario, RoomSlot } from './types';
import { edgeKeyBetween } from './regions';
import { doorEdgeKey } from './walls';

/** Interior walls the scenario ships pre-built, as edge keys.
 *  Each `walls_interior` entry is a pair of ADJACENT CELLS (r1,c1)-(r2,c2) —
 *  the encoding the level editor reads and writes (keyToWallPair there).
 *  Non-adjacent pairs are dropped rather than producing a bogus edge. */
export function preDrawnWallEdges(scenario: Scenario): string[] {
  const out: string[] = [];
  for (const pair of scenario.pre_drawn?.walls_interior ?? []) {
    const [r1, c1, r2, c2] = pair;
    const k = edgeKeyBetween(r1, c1, r2, c2);
    if (k) out.push(k);
  }
  return out;
}

/** Room doors the scenario ships pre-built, as edge key → owning room slot.
 *  Only doors carrying an explicit `room` count — the front door and purely
 *  decorative pre-drawn doors are left out, since `doors` drives room
 *  accessibility scoring. */
export function preDrawnRoomDoors(scenario: Scenario): Record<string, RoomSlot> {
  const out: Record<string, RoomSlot> = {};
  for (const d of scenario.pre_drawn?.doors ?? []) {
    if (!d.room || !d.edge || d.target === 'front_door') continue;
    out[doorEdgeKey(d.cell, d.edge)] = d.room;
  }
  return out;
}

/** True when the scenario ships its interior walls — the player never draws
 *  walls in such a run, so the wall phase is skipped. */
export function hasPrebuiltWalls(scenario: Scenario | null | undefined): boolean {
  return !!scenario?.pre_drawn?.walls_interior?.length;
}

/** True when the scenario also ships the room doors, so the player has no
 *  doors left to cut and the door phase locks straight into window mode.
 *  Deliberately separate from {@link hasPrebuiltWalls}: a scenario may hand
 *  over the walls but leave the doors as the exercise. */
export function hasPrebuiltDoors(scenario: Scenario | null | undefined): boolean {
  return !!scenario && Object.keys(preDrawnRoomDoors(scenario)).length > 0;
}

/** Is this edge one of the scenario's given walls? Those cannot be demolished
 *  — but they CAN have doors cut into them, which is why pre-built walls are
 *  kept out of `lockedWalls` (that set also blocks door placement). */
export function isPreDrawnWall(
  scenario: Scenario | null | undefined, edgeKey: string,
): boolean {
  if (!scenario) return false;
  return preDrawnWallEdges(scenario).includes(edgeKey);
}
