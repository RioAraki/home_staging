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

import type { Scenario } from '../types';

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

function exteriorWallEdges(scenario: Scenario): EdgeKey[] {
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
