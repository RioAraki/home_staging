// Per-scenario game-state persistence to localStorage.
//
// The store's Undoable state shape contains JS `Set`s which don't round-trip
// through JSON, so we hand-serialize. The undo history (`past`) and UI-only
// flags (mode toggles, themeId) are deliberately NOT saved — restoring those
// would be surprising and they're trivially recoverable.

import type { PlacedPiece, Variant } from '../store/game';
import type { RoomSlot } from '../types';

const STORAGE_PREFIX = 'game_save_v1_';

export interface PersistedState {
  /** Schema version — bump if shape changes incompatibly. */
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

export function storageKeyFor(scenarioId: string): string {
  return `${STORAGE_PREFIX}${scenarioId}`;
}

export function loadSavedState(scenarioId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(storageKeyFor(scenarioId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.v !== 1) return null;          // schema mismatch
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(scenarioId: string, snapshot: PersistedState): void {
  try {
    localStorage.setItem(storageKeyFor(scenarioId), JSON.stringify(snapshot));
  } catch {
    // localStorage might be full; silently ignore. The user can still play —
    // they just won't have auto-restore.
  }
}

export function clearSavedState(scenarioId: string): void {
  localStorage.removeItem(storageKeyFor(scenarioId));
}
