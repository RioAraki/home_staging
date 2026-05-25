// Per-scenario game-state persistence to a local JSON file on disk.
//
// Talks to the Vite dev-server middleware in `vite-plugins/game-save-sync.ts`,
// which writes `md/saves/<scenarioId>.json`. The save format mirrors the
// store's Undoable shape but with Sets serialized to arrays and UI-only
// flags + undo history dropped — restoring those would be surprising.

import type { PlacedPiece, Variant } from '../store/game';
import type { RoomSlot } from '../types';

export interface PersistedState {
  v: 1;
  ts: number;
  chosenVariants: Record<number, Variant>;
  activeRoomSlot: RoomSlot | null;
  completedRoomSlots: RoomSlot[];
  revealedCardKeys: string[];
  placedCardKeys: string[];
  skippedCardKeys: string[];
  placedPieces: PlacedPiece[];
  walls: Record<string, true>;
  doors: Record<string, RoomSlot>;
  windows: Record<string, true>;
  jokerUsed: boolean;
  frontDoorEdge: string | null;
  gameFinished: boolean;
}

export async function loadSavedState(scenarioId: string): Promise<PersistedState | null> {
  try {
    const res = await fetch(`/__game/load?scenarioId=${encodeURIComponent(scenarioId)}`);
    if (res.status === 204) return null;          // no save yet
    if (!res.ok) return null;
    const parsed = (await res.json()) as PersistedState;
    if (parsed.v !== 1) return null;              // schema mismatch
    return parsed;
  } catch {
    return null;
  }
}

export async function saveState(scenarioId: string, snapshot: PersistedState): Promise<void> {
  try {
    await fetch(`/__game/save?scenarioId=${encodeURIComponent(scenarioId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  } catch {
    // Best-effort: dev-server might be down, just swallow.
  }
}

export async function clearSavedState(scenarioId: string): Promise<void> {
  try {
    await fetch(`/__game/reset?scenarioId=${encodeURIComponent(scenarioId)}`, {
      method: 'POST',
    });
  } catch {
    // ignore
  }
}
