import { create } from 'zustand';
import type { RoomSlot, Scenario } from '../types';
import { cardByNumberVariant } from '../data';
import { exteriorWallEdges as exteriorWallEdgesFromScenario } from '../lib/walls';

export type Variant = 'A' | 'B';
export type Rotation = 0 | 1 | 2 | 3;
export type WallPhase = 'walls' | 'door';

/** A card "instance" is one slot in a room's furniture_numbers array. Same
 *  number can appear multiple times in a room (e.g. 2 beds); each occurrence
 *  is its own instance with independent reveal/place/skip state. */
export function instanceKey(slot: RoomSlot, slotIdx: number): string {
  return `${slot}:${slotIdx}`;
}

/** Legacy per-(number,variant) key — kept for places that key by furniture
 *  number rather than placement instance (none after this refactor; left in
 *  case of external use). */
export function cardKey(number: number, variant: Variant): string {
  return `${number}-${variant}`;
}

export function hEdge(r: number, c: number): string { return `h:${r}:${c}`; }
export function vEdge(r: number, c: number): string { return `v:${r}:${c}`; }

export interface SelectedOption {
  slot: RoomSlot;
  slotIdx: number;
  number: number;            // denormalized from scenario for convenience
  variant: Variant;          // denormalized from chosenVariants
  optionIndex: number;
  rotation: Rotation;
  mirrored: boolean;
}

export interface PlacedPiece extends SelectedOption {
  origin: [number, number];
  roomSlot: RoomSlot;        // === slot, kept for backwards compat in code
}

/** Undoable state — everything except chosenVariants (set at game start)
 *  and the undo stack itself. */
interface Undoable {
  activeRoomSlot: RoomSlot | null;
  completedRoomSlots: Set<RoomSlot>;
  /** Sets keyed by `instanceKey(slot, slotIdx)`. */
  revealedCardKeys: Set<string>;
  placedCardKeys: Set<string>;
  skippedCardKeys: Set<string>;
  placedPieces: PlacedPiece[];
  selectedOption: SelectedOption | null;
  walls: Record<string, true>;
  doors: Record<string, RoomSlot>;
  /** Exterior-wall edges marked as windows. Purely decorative unless a bonus
   *  condition references them (e.g. line-of-sight). */
  windows: Record<string, true>;
  wallPhase: WallPhase;
  jokerUsed: boolean;
  /** Edge key on the exterior wall designated as the building's front door.
   *  null until the player picks one. */
  frontDoorEdge: string | null;
  /** Player has explicitly clicked "Finish & score" — until then we never
   *  auto-end the game even if all rooms are sealed. */
  gameFinished: boolean;
  lastError: string | null;
}

export interface GameState extends Undoable {
  chosenVariants: Record<number, Variant>;
  past: Undoable[];
  /** Set by initRun — used by actions that need to look up
   *  furniture_numbers[slotIdx] from a (slot, slotIdx) instance. */
  scenario: Scenario | null;
  /** UI-only: true while the player is in "click an exterior edge to set front
   *  door" mode. Not undoable. */
  frontDoorMode: boolean;
  /** UI-only: true while in "click an exterior edge to toggle window" mode. */
  windowMode: boolean;
  /** Visual theme for vector furniture rendering. UI-only, not undoable. */
  themeId: string;

  initRun: (scenario: Scenario) => void;
  selectRoom: (slot: RoomSlot) => void;
  autoRevealRoom: (slot: RoomSlot) => void;
  revealCard: (slot: RoomSlot, slotIdx: number) => void;
  selectOption: (opt: { slot: RoomSlot; slotIdx: number; optionIndex: number }) => void;
  rotateSelection: () => void;
  mirrorSelection: () => void;
  clearSelection: () => void;
  placeSelected: (origin: [number, number]) => boolean;
  skipSelected: () => void;
  skipCard: (slot: RoomSlot, slotIdx: number) => void;
  toggleWall: (edgeKey: string) => void;
  setDoor: (edgeKey: string) => void;
  setWallPhase: (phase: WallPhase) => void;
  completeRoom: () => boolean;
  toggleFrontDoorMode: () => void;
  setFrontDoor: (edgeKey: string) => void;
  toggleWindowMode: () => void;
  toggleWindow: (edgeKey: string) => void;
  setThemeId: (id: string) => void;
  finishGame: () => void;
  unfinishGame: () => void;
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
  windows: {},
  wallPhase: 'walls',
  jokerUsed: false,
  frontDoorEdge: null,
  gameFinished: false,
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
    windows: { ...s.windows },
    wallPhase: s.wallPhase,
    jokerUsed: s.jokerUsed,
    frontDoorEdge: s.frontDoorEdge,
    gameFinished: s.gameFinished,
    lastError: s.lastError,
  };
}

const MAX_HISTORY = 100;

/** Resolve (slot, slotIdx) → the furniture number declared by the scenario. */
function lookupNumber(scenario: Scenario | null, slot: RoomSlot, slotIdx: number): number | null {
  if (!scenario) return null;
  const room = scenario.rooms.find((r) => r.slot === slot);
  if (!room) return null;
  return room.furniture_numbers[slotIdx] ?? null;
}

function doorEdgeKey(cell: [number, number], edge: 'N' | 'S' | 'E' | 'W'): string {
  const [r, c] = cell;
  switch (edge) {
    case 'N': return `h:${r}:${c}`;
    case 'S': return `h:${r + 1}:${c}`;
    case 'W': return `v:${r}:${c}`;
    case 'E': return `v:${r}:${c + 1}`;
  }
}

/** If a scenario has exactly one pre_drawn front door, return its edge so
 *  initRun can lock the front door automatically. Multi-position scenarios
 *  (e.g. barn with 2 choices) still require player interaction. */
function autoFrontDoor(scenario: Scenario): string | null {
  const frontDoors = (scenario.pre_drawn?.doors ?? []).filter(
    (d) => d.target === 'front_door',
  );
  if (frontDoors.length !== 1) return null;
  const d = frontDoors[0];
  if (!d.edge) return null;
  return doorEdgeKey(d.cell, d.edge);
}

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
    scenario: null,
    frontDoorMode: false,
    windowMode: false,
    themeId: 'blueprint',

    initRun: (scenario) => {
      const nums = new Set<number>();
      for (const room of scenario.rooms) for (const n of room.furniture_numbers) nums.add(n);
      const chosen: Record<number, Variant> = {};
      for (const n of nums) chosen[n] = pickRandomVariant();
      const lockedFrontDoor = autoFrontDoor(scenario);
      // initRun is a hard reset (not undoable beyond it)
      set({
        ...blank,
        chosenVariants: chosen,
        past: [],
        scenario,
        frontDoorMode: false,
        windowMode: false,
        frontDoorEdge: lockedFrontDoor,
      });
    },

    selectRoom: (slot) => {
      const { activeRoomSlot, completedRoomSlots, placedPieces } = get();
      if (completedRoomSlots.has(slot)) return;
      if (activeRoomSlot && activeRoomSlot !== slot && !completedRoomSlots.has(activeRoomSlot)) {
        // Allow switching away from the active room only if the player hasn't
        // placed anything in it yet — they're still deciding which room to
        // start with. Once a piece lands the room is "in progress".
        const hasPlacedInActive = placedPieces.some((p) => p.roomSlot === activeRoomSlot);
        if (hasPlacedInActive) return;
      }
      set({ activeRoomSlot: slot, wallPhase: 'walls', lastError: null });
    },

    autoRevealRoom: (slot) => {
      const { scenario, revealedCardKeys } = get();
      if (!scenario) return;
      const room = scenario.rooms.find((r) => r.slot === slot);
      if (!room) return;
      const next = new Set(revealedCardKeys);
      let changed = false;
      for (let i = 0; i < room.furniture_numbers.length; i++) {
        const k = instanceKey(slot, i);
        if (!next.has(k)) { next.add(k); changed = true; }
      }
      if (changed) set({ revealedCardKeys: next });
    },

    revealCard: (slot, slotIdx) => {
      const key = instanceKey(slot, slotIdx);
      if (get().revealedCardKeys.has(key)) return;
      const next = new Set(get().revealedCardKeys);
      next.add(key);
      set({ revealedCardKeys: next });
    },

    selectOption: ({ slot, slotIdx, optionIndex }) => {
      const { scenario, chosenVariants } = get();
      const number = lookupNumber(scenario, slot, slotIdx);
      if (number === null) return;
      const variant = chosenVariants[number] ?? 'A';
      mutate(() => set({
        selectedOption: {
          slot,
          slotIdx,
          number,
          variant,
          optionIndex,
          rotation: 0,
          mirrored: false,
        },
        lastError: null,
      }));
    },

    rotateSelection: () => {
      const s = get().selectedOption;
      if (!s) return;
      set({ selectedOption: { ...s, rotation: (((s.rotation + 1) % 4) as Rotation) } });
    },

    mirrorSelection: () => {
      const s = get().selectedOption;
      if (!s) return;
      const { jokerUsed } = get();
      if (!s.mirrored && jokerUsed) {
        set({ lastError: 'Joker already used — mirroring is no longer available.' });
        return;
      }
      set({ selectedOption: { ...s, mirrored: !s.mirrored }, lastError: null });
    },

    clearSelection: () => set({ selectedOption: null, lastError: null }),

    placeSelected: (origin) => {
      const s = get().selectedOption;
      const room = get().activeRoomSlot;
      if (!s || !room) return false;
      const key = instanceKey(s.slot, s.slotIdx);
      mutate(() => {
        const placedPiece: PlacedPiece = { ...s, origin, roomSlot: s.slot };
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
        const key = instanceKey(s.slot, s.slotIdx);
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

    skipCard: (slot, slotIdx) => {
      const key = instanceKey(slot, slotIdx);
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

    setWallPhase: (phase) => set({ wallPhase: phase, lastError: null }),

    toggleFrontDoorMode: () =>
      set({ frontDoorMode: !get().frontDoorMode, lastError: null }),

    setFrontDoor: (edgeKey) => {
      const { scenario } = get();
      const forced = scenario?.rules?.front_door?.forced_cells ?? [];
      if (forced.length > 0) {
        // Player can only pick an edge whose indoor-side cell is in forced_cells.
        const [type, rStr, cStr] = edgeKey.split(':');
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        const sideA: [number, number] = type === 'h' ? [r - 1, c] : [r, c - 1];
        const sideB: [number, number] = type === 'h' ? [r, c] : [r, c];
        const allowed = forced.some(
          (fc) =>
            (fc[0] === sideA[0] && fc[1] === sideA[1]) ||
            (fc[0] === sideB[0] && fc[1] === sideB[1]),
        );
        if (!allowed) {
          set({
            lastError:
              'This scenario forces the front door to specific cells — pick one of the highlighted edges.',
            frontDoorMode: false,
          });
          return;
        }
      }
      mutate(() => set({ frontDoorEdge: edgeKey, lastError: null }));
      set({ frontDoorMode: false });
    },

    toggleWindowMode: () =>
      set({
        windowMode: !get().windowMode,
        frontDoorMode: false,
        lastError: null,
      }),

    toggleWindow: (edgeKey) => {
      // Caller already validated the edge is on the building exterior; we
      // double-check by re-deriving from scenario data.
      const { scenario, windows } = get();
      if (!scenario) return;
      const exteriorSet = new Set(
        exteriorWallEdgesFromScenario(scenario),
      );
      if (!exteriorSet.has(edgeKey)) {
        set({ lastError: 'Windows can only be placed on exterior walls.' });
        return;
      }
      mutate(() => {
        const next = { ...windows };
        if (next[edgeKey]) delete next[edgeKey];
        else next[edgeKey] = true;
        set({ windows: next, lastError: null });
      });
    },

    setThemeId: (id) => set({ themeId: id }),

    finishGame: () => mutate(() => set({ gameFinished: true, lastError: null })),
    unfinishGame: () => mutate(() => set({ gameFinished: false })),

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

    reset: () =>
      set({
        ...blank,
        chosenVariants: get().chosenVariants,
        past: [],
        frontDoorMode: false,
        windowMode: false,
      }),
  };
});

// ────────────────────── selectors ──────────────────────

export function isRoomReadyToSeal(
  scenario: Scenario,
  state: {
    placedCardKeys: Set<string>;
    skippedCardKeys: Set<string>;
  },
  slot: RoomSlot,
): boolean {
  const room = scenario.rooms.find((r) => r.slot === slot);
  if (!room) return false;
  return room.furniture_numbers.every((_, slotIdx) => {
    const key = instanceKey(slot, slotIdx);
    return state.placedCardKeys.has(key) || state.skippedCardKeys.has(key);
  });
}

export { cardByNumberVariant };
