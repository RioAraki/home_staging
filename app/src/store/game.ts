import { create } from 'zustand';
import type { RoomSlot, Scenario } from '../types';
import { cardByNumberVariant } from '../data';

export type Variant = 'A' | 'B';
export type Rotation = 0 | 1 | 2 | 3;
export type WallPhase = 'walls' | 'door';

export function cardKey(number: number, variant: Variant): string {
  return `${number}-${variant}`;
}

export function hEdge(r: number, c: number): string { return `h:${r}:${c}`; }
export function vEdge(r: number, c: number): string { return `v:${r}:${c}`; }

export interface SelectedOption {
  number: number;
  variant: Variant;
  optionIndex: number;
  rotation: Rotation;
  mirrored: boolean;
}

export interface PlacedPiece extends SelectedOption {
  origin: [number, number];
  roomSlot: RoomSlot;
}

/** Undoable state — everything except chosenVariants (set at game start)
 *  and the undo stack itself. */
interface Undoable {
  activeRoomSlot: RoomSlot | null;
  completedRoomSlots: Set<RoomSlot>;
  revealedCardKeys: Set<string>;
  placedCardKeys: Set<string>;
  skippedCardKeys: Set<string>;
  placedPieces: PlacedPiece[];
  selectedOption: SelectedOption | null;
  walls: Record<string, true>;
  doors: Record<string, RoomSlot>;
  wallPhase: WallPhase;
  jokerUsed: boolean;
  lastError: string | null;
}

export interface GameState extends Undoable {
  chosenVariants: Record<number, Variant>;
  past: Undoable[];

  initRun: (scenario: Scenario) => void;
  selectRoom: (slot: RoomSlot) => void;
  autoRevealRoomCards: (numbers: number[]) => void;
  revealCard: (number: number, variant: Variant) => void;
  selectOption: (opt: { number: number; variant: Variant; optionIndex: number }) => void;
  rotateSelection: () => void;
  mirrorSelection: () => void;
  clearSelection: () => void;
  placeSelected: (origin: [number, number]) => boolean;
  skipSelected: () => void;
  skipCard: (number: number, variant: Variant) => void;
  toggleWall: (edgeKey: string) => void;
  setDoor: (edgeKey: string) => void;
  setWallPhase: (phase: WallPhase) => void;
  completeRoom: () => boolean;
  undo: () => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

function pickRandomVariant(): Variant {
  return Math.random() < 0.5 ? 'A' : 'B';
}

const blank: Undoable = {
  activeRoomSlot: null,
  completedRoomSlots: new Set<RoomSlot>(),
  revealedCardKeys: new Set<string>(),
  placedCardKeys: new Set<string>(),
  skippedCardKeys: new Set<string>(),
  placedPieces: [],
  selectedOption: null,
  walls: {},
  doors: {},
  wallPhase: 'walls',
  jokerUsed: false,
  lastError: null,
};

function snapshot(s: Undoable): Undoable {
  return {
    activeRoomSlot: s.activeRoomSlot,
    completedRoomSlots: new Set(s.completedRoomSlots),
    revealedCardKeys: new Set(s.revealedCardKeys),
    placedCardKeys: new Set(s.placedCardKeys),
    skippedCardKeys: new Set(s.skippedCardKeys),
    placedPieces: [...s.placedPieces],
    selectedOption: s.selectedOption ? { ...s.selectedOption } : null,
    walls: { ...s.walls },
    doors: { ...s.doors },
    wallPhase: s.wallPhase,
    jokerUsed: s.jokerUsed,
    lastError: s.lastError,
  };
}

const MAX_HISTORY = 100;

export const useGameStore = create<GameState>((set, get) => {
  /** Wrap a mutation: snapshot current state into history, then apply patch. */
  const mutate = (apply: () => void) => {
    const snap = snapshot(get());
    const newPast = [...get().past, snap].slice(-MAX_HISTORY);
    set({ past: newPast });
    apply();
  };

  return {
    ...blank,
    chosenVariants: {},
    past: [],

    initRun: (scenario) => {
      const nums = new Set<number>();
      for (const room of scenario.rooms) for (const n of room.furniture_numbers) nums.add(n);
      const chosen: Record<number, Variant> = {};
      for (const n of nums) chosen[n] = pickRandomVariant();
      // initRun is a hard reset (not undoable beyond it)
      set({ ...blank, chosenVariants: chosen, past: [] });
    },

    selectRoom: (slot) => {
      const { activeRoomSlot, completedRoomSlots } = get();
      if (activeRoomSlot && activeRoomSlot !== slot && !completedRoomSlots.has(activeRoomSlot)) return;
      if (completedRoomSlots.has(slot)) return;
      mutate(() => set({ activeRoomSlot: slot, wallPhase: 'walls', lastError: null }));
    },

    autoRevealRoomCards: (nums) => {
      const { chosenVariants, revealedCardKeys } = get();
      const next = new Set(revealedCardKeys);
      let changed = false;
      for (const n of nums) {
        const v = chosenVariants[n] ?? 'A';
        const k = cardKey(n, v);
        if (!next.has(k)) { next.add(k); changed = true; }
      }
      if (changed) set({ revealedCardKeys: next });
    },

    revealCard: (number, variant) => {
      const key = cardKey(number, variant);
      if (get().revealedCardKeys.has(key)) return;
      mutate(() => {
        const next = new Set(get().revealedCardKeys);
        next.add(key);
        set({ revealedCardKeys: next });
      });
    },

    selectOption: (opt) => {
      mutate(() => set({
        selectedOption: {
          number: opt.number,
          variant: opt.variant,
          optionIndex: opt.optionIndex,
          rotation: 0,
          mirrored: false,
        },
        lastError: null,
      }));
    },

    rotateSelection: () => {
      const s = get().selectedOption;
      if (!s) return;
      mutate(() => set({ selectedOption: { ...s, rotation: (((s.rotation + 1) % 4) as Rotation) } }));
    },

    mirrorSelection: () => {
      const s = get().selectedOption;
      if (!s) return;
      const { jokerUsed } = get();
      if (!s.mirrored && jokerUsed) {
        set({ lastError: 'Joker already used — mirroring is no longer available.' });
        return;
      }
      mutate(() => set({ selectedOption: { ...s, mirrored: !s.mirrored }, lastError: null }));
    },

    clearSelection: () => mutate(() => set({ selectedOption: null, lastError: null })),

    placeSelected: (origin) => {
      const s = get().selectedOption;
      const room = get().activeRoomSlot;
      if (!s || !room) return false;
      const key = cardKey(s.number, s.variant);
      mutate(() => {
        const placedPiece: PlacedPiece = { ...s, origin, roomSlot: room };
        const nextPlaced = [...get().placedPieces, placedPiece];
        const nextPlacedKeys = new Set(get().placedCardKeys);
        nextPlacedKeys.add(key);
        const newJokerUsed = get().jokerUsed || s.mirrored;
        set({
          placedPieces: nextPlaced,
          placedCardKeys: nextPlacedKeys,
          selectedOption: null,
          jokerUsed: newJokerUsed,
          lastError: null,
        });
      });
      return true;
    },

    skipSelected: () => {
      const s = get().selectedOption;
      if (!s) return;
      mutate(() => {
        const key = cardKey(s.number, s.variant);
        const nextRevealed = new Set(get().revealedCardKeys);
        nextRevealed.add(key);
        const nextSkipped = new Set(get().skippedCardKeys);
        nextSkipped.add(key);
        set({
          revealedCardKeys: nextRevealed,
          skippedCardKeys: nextSkipped,
          selectedOption: null,
          lastError: null,
        });
      });
    },

    skipCard: (number, variant) => {
      const key = cardKey(number, variant);
      if (get().placedCardKeys.has(key) || get().skippedCardKeys.has(key)) return;
      mutate(() => {
        const nextRevealed = new Set(get().revealedCardKeys);
        nextRevealed.add(key);
        const nextSkipped = new Set(get().skippedCardKeys);
        nextSkipped.add(key);
        set({ revealedCardKeys: nextRevealed, skippedCardKeys: nextSkipped, lastError: null });
      });
    },

    toggleWall: (edgeKey) => {
      const { walls, doors, wallPhase } = get();
      if (wallPhase !== 'walls') return;
      if (doors[edgeKey]) return;
      mutate(() => {
        const next = { ...walls };
        if (next[edgeKey]) delete next[edgeKey];
        else next[edgeKey] = true;
        set({ walls: next });
      });
    },

    setDoor: (edgeKey) => {
      const { walls, doors, wallPhase, activeRoomSlot } = get();
      if (wallPhase !== 'door' || !activeRoomSlot) return;
      if (!walls[edgeKey]) return;
      mutate(() => {
        const nextDoors = { ...doors };
        if (nextDoors[edgeKey] === activeRoomSlot) {
          delete nextDoors[edgeKey];
        } else {
          for (const key of Object.keys(nextDoors)) {
            if (nextDoors[key] === activeRoomSlot) delete nextDoors[key];
          }
          nextDoors[edgeKey] = activeRoomSlot;
        }
        set({ doors: nextDoors, lastError: null });
      });
    },

    setWallPhase: (phase) => mutate(() => set({ wallPhase: phase, lastError: null })),

    completeRoom: () => {
      const { activeRoomSlot, doors } = get();
      if (!activeRoomSlot) return false;
      const myDoors = Object.values(doors).filter((r) => r === activeRoomSlot).length;
      if (myDoors !== 1) {
        set({ lastError: 'Each room needs exactly one door before closing.' });
        return false;
      }
      mutate(() => {
        const nextCompleted = new Set(get().completedRoomSlots);
        nextCompleted.add(activeRoomSlot);
        set({
          completedRoomSlots: nextCompleted,
          activeRoomSlot: null,
          wallPhase: 'walls',
          lastError: null,
        });
      });
      return true;
    },

    undo: () => {
      const past = get().past;
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      set({ ...prev, past: past.slice(0, -1) });
    },

    setError: (msg) => set({ lastError: msg }),

    reset: () => set({ ...blank, chosenVariants: get().chosenVariants, past: [] }),
  };
});

// ────────────────────── selectors ──────────────────────

export function isRoomReadyToSeal(
  scenario: Scenario,
  state: {
    chosenVariants: Record<number, Variant>;
    placedCardKeys: Set<string>;
    skippedCardKeys: Set<string>;
  },
  slot: RoomSlot,
): boolean {
  const room = scenario.rooms.find((r) => r.slot === slot);
  if (!room) return false;
  return room.furniture_numbers.every((n) => {
    const v = state.chosenVariants[n] ?? 'A';
    const key = cardKey(n, v);
    return state.placedCardKeys.has(key) || state.skippedCardKeys.has(key);
  });
}

export { cardByNumberVariant };
