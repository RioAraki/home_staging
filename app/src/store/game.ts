import { create } from 'zustand';
import type { RoomSlot, Scenario } from '../types';
import { cardByNumberVariant } from '../data';
import { exteriorWallEdges as exteriorWallEdgesFromScenario } from '../lib/walls';
import type { PersistedState } from '../lib/persistence';

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
  /** UI-only: true while in demolish mode — click a shape cell to remove
   *  the piece on it, click a wall/door/window edge to remove that edge. */
  demolishMode: boolean;
  /** Visual theme for vector furniture rendering. UI-only, not undoable. */
  themeId: string;

  initRun: (scenario: Scenario, saved?: PersistedState | null) => void;
  resetCurrentScenario: () => void;
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
  toggleDemolishMode: () => void;
  demolishAtCell: (cell: [number, number]) => void;
  demolishAtEdge: (edgeKey: string) => void;
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

/** The two cells separated by an edge key ("h:r:c" = horizontal edge between
 *  rows r-1 and r at column c; "v:r:c" = vertical edge between columns c-1
 *  and c at row r). Used to derive which room "owns" a wall / window. */
function edgeAdjacentCells(edgeKey: string): [[number, number], [number, number]] {
  const [type, rStr, cStr] = edgeKey.split(':');
  const r = parseInt(rStr, 10);
  const c = parseInt(cStr, 10);
  return type === 'h'
    ? [[r - 1, c], [r, c]]
    : [[r, c - 1], [r, c]];
}

/** Which rooms' placed pieces touch either side of this edge. Empty set ⇒
 *  "orphan" edge with no piece nearby (e.g. a wall drawn in empty corridor).
 *  Used by demolish to scope wall / window removal to the active room. */
function edgeRoomAffinity(edgeKey: string, placed: PlacedPiece[]): Set<RoomSlot> {
  const [a, b] = edgeAdjacentCells(edgeKey);
  const rooms = new Set<RoomSlot>();
  for (const p of placed) {
    if (rooms.has(p.roomSlot)) continue;
    const card = cardByNumberVariant(p.number, p.variant);
    const opt = card?.options.find((o) => o.option_index === p.optionIndex);
    if (!opt) continue;
    const [bRows, bCols] = opt.bbox;
    for (const [sr, sc] of [...opt.shape, ...opt.open_spaces]) {
      let rr = sr, cc = sc;
      if (p.mirrored) cc = bCols - 1 - cc;
      for (let i = 0; i < p.rotation; i++) {
        const nr = cc;
        const nc = (i % 2 === 0 ? bRows : bCols) - 1 - rr;
        rr = nr; cc = nc;
      }
      const ar = p.origin[0] + rr;
      const ac = p.origin[1] + cc;
      if ((ar === a[0] && ac === a[1]) || (ar === b[0] && ac === b[1])) {
        rooms.add(p.roomSlot);
        break;
      }
    }
  }
  return rooms;
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
    demolishMode: false,
    themeId: 'blueprint',

    initRun: (scenario, saved) => {
      // If the caller pre-loaded a saved session, restore from it. Otherwise
      // start fresh with random variants. Loading from disk is async so the
      // caller (App.tsx) does the fetch before invoking this synchronously.
      if (saved) {
        set({
          ...blank,
          chosenVariants: saved.chosenVariants,
          activeRoomSlot: saved.activeRoomSlot,
          completedRoomSlots: new Set(saved.completedRoomSlots),
          revealedCardKeys: new Set(saved.revealedCardKeys),
          placedCardKeys: new Set(saved.placedCardKeys),
          skippedCardKeys: new Set(saved.skippedCardKeys),
          placedPieces: saved.placedPieces,
          walls: saved.walls,
          doors: saved.doors,
          windows: saved.windows,
          jokerUsed: saved.jokerUsed,
          frontDoorEdge: saved.frontDoorEdge,
          gameFinished: saved.gameFinished,
          scenario,
          past: [],
          frontDoorMode: false,
          windowMode: false,
        });
        return;
      }
      const nums = new Set<number>();
      for (const room of scenario.rooms) for (const n of room.furniture_numbers) nums.add(n);
      const chosen: Record<number, Variant> = {};
      for (const n of nums) chosen[n] = pickRandomVariant();
      const lockedFrontDoor = autoFrontDoor(scenario);
      set({
        ...blank,
        chosenVariants: chosen,
        past: [],
        scenario,
        frontDoorMode: false,
        windowMode: false,
        demolishMode: false,
        frontDoorEdge: lockedFrontDoor,
      });
    },

    resetCurrentScenario: () => {
      // Note: this only resets the in-memory state. The caller is
      // responsible for clearing the on-disk save first (via the async
      // clearSavedState helper in lib/persistence).
      const { scenario } = get();
      if (!scenario) return;
      const nums = new Set<number>();
      for (const room of scenario.rooms) for (const n of room.furniture_numbers) nums.add(n);
      const chosen: Record<number, Variant> = {};
      for (const n of nums) chosen[n] = pickRandomVariant();
      const lockedFrontDoor = autoFrontDoor(scenario);
      set({
        ...blank,
        chosenVariants: chosen,
        past: [],
        scenario,
        frontDoorMode: false,
        windowMode: false,
        demolishMode: false,
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
      const { scenario, chosenVariants, demolishMode } = get();
      // While demolish mode is active, suppress new furniture selections —
      // the canvas is in "click to delete" mode and a hovering ghost piece
      // would be confusing.
      if (demolishMode) return;
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
      set({
        frontDoorMode: !get().frontDoorMode,
        windowMode: false,
        demolishMode: false,
        lastError: null,
      }),

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
        demolishMode: false,
        lastError: null,
      }),

    toggleDemolishMode: () =>
      set({
        demolishMode: !get().demolishMode,
        frontDoorMode: false,
        windowMode: false,
        selectedOption: null,
        lastError: null,
      }),

    demolishAtCell: ([targetR, targetC]) => {
      const { placedPieces, placedCardKeys, completedRoomSlots, activeRoomSlot } = get();
      // Find pieces whose SHAPE contains this cell. Open-space cells don't
      // count — clicking those is a no-op (per user rule).
      const hits: number[] = [];
      placedPieces.forEach((p, idx) => {
        const card = cardByNumberVariant(p.number, p.variant);
        const opt = card?.options.find((o) => o.option_index === p.optionIndex);
        if (!opt) return;
        // Inline transform — we don't want to drag the geometry import into
        // the store; reuse the shape cells stored by the piece's data.
        // Apply rotation + mirror, same as transformOption.
        const [bRows, bCols] = opt.bbox;
        for (const [sr, sc] of opt.shape) {
          let rr = sr, cc = sc;
          if (p.mirrored) cc = bCols - 1 - cc;
          for (let i = 0; i < p.rotation; i++) {
            const nr = cc;
            const nc = (i % 2 === 0 ? bRows : bCols) - 1 - rr;
            rr = nr; cc = nc;
          }
          if (p.origin[0] + rr === targetR && p.origin[1] + cc === targetC) {
            hits.push(idx);
            break;
          }
        }
      });
      if (hits.length === 0) return;

      // Demolish scope: while actively building a room (active room not yet
      // sealed), only that room's furniture is demolishable. Once the room
      // is sealed (or no active room), any room's furniture can be removed.
      const buildingRoom =
        activeRoomSlot && !completedRoomSlots.has(activeRoomSlot) ? activeRoomSlot : null;
      const toRemove = buildingRoom
        ? hits.filter((idx) => placedPieces[idx].roomSlot === buildingRoom)
        : hits;
      if (toRemove.length === 0) {
        set({
          lastError: `Currently building Room ${buildingRoom} — can only demolish that room's furniture. Seal or finish it first.`,
        });
        return;
      }
      mutate(() => {
        const removeSet = new Set(toRemove);
        const newPieces = placedPieces.filter((_, idx) => !removeSet.has(idx));
        const removedInstances = toRemove.map((idx) =>
          instanceKey(placedPieces[idx].slot, placedPieces[idx].slotIdx),
        );
        const newPlacedKeys = new Set(placedCardKeys);
        for (const k of removedInstances) newPlacedKeys.delete(k);
        const affectedRooms = new Set(
          toRemove.map((idx) => placedPieces[idx].roomSlot),
        );
        const newCompleted = new Set(completedRoomSlots);
        for (const s of affectedRooms) newCompleted.delete(s);
        set({
          placedPieces: newPieces,
          placedCardKeys: newPlacedKeys,
          completedRoomSlots: newCompleted,
          gameFinished: false,
          lastError: null,
        });
      });
    },

    demolishAtEdge: (edgeKey) => {
      const {
        walls, doors, windows, frontDoorEdge, scenario,
        completedRoomSlots, activeRoomSlot, placedPieces,
      } = get();
      // Scope: while a room is actively being built (selected + not sealed),
      // only that room's walls / doors / windows are demolishable. The
      // front door is building-wide and must be removed outside edit mode.
      const buildingRoom =
        activeRoomSlot && !completedRoomSlots.has(activeRoomSlot) ? activeRoomSlot : null;
      const scopeMsg = `Currently building Room ${buildingRoom} — can only demolish that room's walls / doors / windows.`;

      // Front door: building-wide; blocked entirely while editing a room.
      if (frontDoorEdge === edgeKey) {
        if (scenario && autoFrontDoor(scenario)) {
          set({ lastError: "This scenario fixes the front door — can't demolish." });
          return;
        }
        if (buildingRoom) {
          set({
            lastError: `Currently building Room ${buildingRoom} — exit room edit mode to demolish the front door.`,
          });
          return;
        }
        mutate(() => set({ frontDoorEdge: null, gameFinished: false, lastError: null }));
        return;
      }

      // Window: scope by adjacent-piece room. An exterior window touching
      // only another room's pieces is off-limits while building the active.
      if (windows[edgeKey]) {
        if (buildingRoom) {
          const aff = edgeRoomAffinity(edgeKey, placedPieces);
          if (aff.size > 0 && !aff.has(buildingRoom)) {
            set({ lastError: scopeMsg });
            return;
          }
        }
        mutate(() => {
          const next = { ...windows };
          delete next[edgeKey];
          set({ windows: next, gameFinished: false, lastError: null });
        });
        return;
      }

      // Wall or door.
      if (walls[edgeKey] || doors[edgeKey]) {
        const doorOwner = doors[edgeKey];
        if (buildingRoom) {
          // Doors carry an explicit owner; walls inherit ownership from any
          // adjacent piece. Orphan walls (no adjacent piece — typically
          // drawn moments ago in this same wall phase) are always allowed.
          const belongs = doorOwner
            ? doorOwner === buildingRoom
            : (() => {
                const aff = edgeRoomAffinity(edgeKey, placedPieces);
                return aff.size === 0 || aff.has(buildingRoom);
              })();
          if (!belongs) {
            set({ lastError: scopeMsg });
            return;
          }
        }
        mutate(() => {
          const nextWalls = { ...walls };
          delete nextWalls[edgeKey];
          const nextDoors = { ...doors };
          const owner = nextDoors[edgeKey];
          delete nextDoors[edgeKey];
          // A demolished door un-finalises its owner room.
          const newCompleted = new Set(completedRoomSlots);
          if (owner) newCompleted.delete(owner);
          set({
            walls: nextWalls,
            doors: nextDoors,
            completedRoomSlots: newCompleted,
            gameFinished: false,
            lastError: null,
          });
        });
      }
    },

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
