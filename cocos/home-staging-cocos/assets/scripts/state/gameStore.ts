import { createStore } from './zustandVanilla';
import type { RoomSlot, Scenario } from '../core/types';
import { exteriorWallEdges as exteriorWallEdgesFromScenario, validateWallTopology, doorEdgeKey } from '../core/walls';
import { frontDoorOpensIntoRoom, computeRegions, assignRoomsToRegions } from '../core/regions';
import { resolveOption, pieceShapeCells, pieceFootprintCells } from '../core/pieces';
import { roomItemCount, roomItemAt } from '../core/roomItems';
import { furnitureByName } from '../core/dataLoader';
import { audioManager } from '../platform/audio';
import { loadAudioSettings, saveAudioSettings } from '../platform/audioSettings';
import { currentCardIndex as firstUnresolved, roomPhase as phaseOf, suppressOpenCellCheck, type RoomPhase } from './roomFlow';

export type Variant = 'A' | 'B';
export type Rotation = 0 | 1 | 2 | 3;
export type WallPhase = 'walls' | 'door';

/** A card "instance" is one slot in a room's furniture_numbers array. Same
 *  number can appear multiple times in a room (e.g. 2 beds); each occurrence
 *  is its own instance with independent reveal/place/skip state. */
export function instanceKey(slot: RoomSlot, slotIdx: number): string {
  return `${slot}:${slotIdx}`;
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
  name?: string;             // named furniture: unified-library key
  source?: 'card' | 'custom';
}

export interface PlacedPiece extends SelectedOption {
  origin: [number, number];
  roomSlot: RoomSlot;        // === slot, kept for backwards compat in code
}

/** Shape of a restored session. Only the fields initRun consumes are typed;
 *  unknown extra fields are ignored. `lockedWalls` is optional for saves
 *  written before it was persisted — see initRun for the fallback. */
export interface PersistedState {
  chosenVariants: Record<number, Variant>;
  activeRoomSlot: RoomSlot | null;
  completedRoomSlots: RoomSlot[];
  revealedCardKeys: string[];
  placedCardKeys: string[];
  skippedCardKeys: string[];
  placedPieces: PlacedPiece[];
  walls: Record<string, true>;
  lockedWalls?: string[];
  doors: Record<string, RoomSlot>;
  windows: Record<string, true>;
  jokerUsed: boolean;
  frontDoorEdge: string | null;
  gameFinished: boolean;
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
  /** Edge keys of walls that belong to already-sealed rooms. They render white,
   *  can't be removed, and can't take the active room's door. */
  lockedWalls: Set<string>;
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
  /** UI-only: BGM mute toggle. Persisted globally (not per scenario). */
  bgmMuted: boolean;
  /** UI-only: SFX mute toggle. Persisted globally (not per scenario). */
  sfxMuted: boolean;
  setBgmMuted: (muted: boolean) => void;
  setSfxMuted: (muted: boolean) => void;

  initRun: (scenario: Scenario, saved?: PersistedState | null) => void;
  resetCurrentScenario: () => void;
  selectRoom: (slot: RoomSlot) => void;
  autoRevealRoom: (slot: RoomSlot) => void;
  revealCard: (slot: RoomSlot, slotIdx: number) => void;
  selectOption: (opt: { slot: RoomSlot; slotIdx: number; optionIndex: number }) => void;
  rotateSelection: (dir?: 1 | -1) => void;
  mirrorSelection: () => void;
  clearSelection: () => void;
  placeSelected: (origin: [number, number]) => boolean;
  skipSelected: () => void;
  finishPlacing: () => void;
  skipCard: (slot: RoomSlot, slotIdx: number) => void;
  unskipCard: (slot: RoomSlot, slotIdx: number) => void;
  unplaceCard: (slot: RoomSlot, slotIdx: number) => void;
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
  lockedWalls: new Set<string>(),
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
    lockedWalls: new Set(s.lockedWalls),
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

// ── Derived per-room flow (sequential cards + furniture/construction phase) ──
// Computed from placedCardKeys/skippedCardKeys so they stay in sync with undo
// without extra undoable state. See state/roomFlow.ts.

function activeRoom(s: GameState) {
  if (!s.scenario || !s.activeRoomSlot) return null;
  return s.scenario.rooms.find((r) => r.slot === s.activeRoomSlot) ?? null;
}

/** First unresolved (not placed, not skipped) card index in the active room. */
export function currentCardIndexOf(s: GameState): number {
  const room = activeRoom(s);
  if (!room || !s.activeRoomSlot) return 0;
  const slot = s.activeRoomSlot;
  return firstUnresolved(roomItemCount(room), (i) => {
    const k = instanceKey(slot, i);
    return s.placedCardKeys.has(k) || s.skippedCardKeys.has(k);
  });
}

/** 'construction' once the active room's furniture is all placed/skipped.
 *  'furniture' otherwise (including when no room is selected yet). */
export function getRoomPhase(s: GameState): RoomPhase {
  const room = activeRoom(s);
  if (!room) return 'furniture';
  return phaseOf(roomItemCount(room), currentCardIndexOf(s));
}

/** Whether the "inaccessible open cell" / "trapped furniture" overlay should be
 *  suppressed. Only suppress while the player is actively CONSTRUCTING a room:
 *  drawing its walls (open cells get temporarily enclosed mid-draw), or placing
 *  its door before any door exists. During the FURNITURE phase — when furniture
 *  is dragged/placed — the check MUST run, because that's exactly when a piece
 *  can wall off another piece's open cells.
 *
 *  NOTE: `wallPhase` defaults to 'walls' and stays there for the whole furniture
 *  phase, so gating on `wallPhase === 'walls'` alone (the old behaviour) wrongly
 *  suppressed the check during placement — the bug this guard fixes. */
export function shouldSuppressOpenCellCheck(s: GameState): boolean {
  const hasDoorForActiveRoom = !!s.activeRoomSlot &&
    Object.values(s.doors as Record<string, string>).includes(s.activeRoomSlot);
  return suppressOpenCellCheck({
    roomPhase: getRoomPhase(s),
    wallPhase: s.wallPhase,
    activeRoomSlot: s.activeRoomSlot,
    hasDoorForActiveRoom,
  });
}

/**
 * Are the player's walls a closed boundary? Uses the web's topology rule: every
 * player wall must be anchored at BOTH endpoints to another wall OR the
 * building's exterior outline (which counts implicitly). This catches gaps and
 * dangling walls; the exterior boundary needs no explicit player wall.
 */
export function isActiveRoomEnclosed(s: GameState): boolean {
  if (!s.scenario || !s.activeRoomSlot) return false;
  if (!validateWallTopology(s.scenario, s.walls).ok) return false;

  // For multi-room scenarios, also require that all furniture placed in
  // the active room sits within a single enclosed region (not split across
  // wall boundaries, and none left outside the player's walls).
  if (s.scenario.rooms.length > 1) {
    const regionMap = computeRegions(s.scenario, s.walls);
    if (regionMap.regions.size < 2) return false;   // no real enclosure yet
    const roomRegions = new Set<number>();
    for (const p of s.placedPieces.filter(pp => pp.slot === s.activeRoomSlot)) {
      for (const [r, c] of pieceFootprintCells(p)) {
        const reg = regionMap.cellToRegion.get(`${r},${c}`);
        if (reg !== undefined) roomRegions.add(reg);
      }
      if (roomRegions.size > 1) return false;  // piece is split by a wall
    }
    if (roomRegions.size > 1) return false;   // furniture spans different regions
  }
  return true;
}

/** The card to present right now, or null in construction / no active room. */
export function currentCard(
  s: GameState,
): { slot: RoomSlot; slotIdx: number; number: number; name?: string } | null {
  const room = activeRoom(s);
  if (!room || !s.activeRoomSlot) return null;
  const idx = currentCardIndexOf(s);
  const item = roomItemAt(room, idx);
  if (!item) return null;
  if (item.kind === 'named') {
    const e = furnitureByName(item.name);
    return { slot: s.activeRoomSlot, slotIdx: idx, number: e?.number ?? 0, name: item.name };
  }
  return { slot: s.activeRoomSlot, slotIdx: idx, number: item.number };
}

/** Is grid cell (r,c) an indoor cell in this scenario? */
function isIndoorCell(scenario: Scenario, r: number, c: number): boolean {
  if (r < 0 || c < 0) return false;
  const rows = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
  const ch = rows[r]?.[c];
  return !!ch && scenario.grid.legend[ch]?.terrain === 'indoor';
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
    for (const [ar, ac] of pieceFootprintCells(p)) {
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

const initialAudioSettings = loadAudioSettings();

export const gameStore = createStore<GameState>((set, get) => {
  /** Wrap a mutation: snapshot current state into history, then apply patch. */
  const mutate = (apply: () => void) => {
    const snap = snapshot(get());
    const newPast = [...get().past, snap].slice(-MAX_HISTORY);
    set({ past: newPast });
    apply();
  };

  /** Walls/doors/windows/demolish are locked until the active room's furniture
   *  is all placed or skipped (the 'construction' phase). */
  const constructionLocked = () => getRoomPhase(get()) !== 'construction';

  /** The front door (大门) may be set while building a room (construction
   *  phase) OR in the final stage after every room is sealed — that final
   *  stage is where the player places 大门 before 结算. */
  const frontDoorLocked = () => {
    const s = get();
    return getRoomPhase(s) !== 'construction' && !allRoomsSealed(s);
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
    bgmMuted: initialAudioSettings.bgmMuted,
    sfxMuted: initialAudioSettings.sfxMuted,

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
          // Older saves don't carry lockedWalls. Fallback: if any room was
          // sealed, treat every restored wall as locked (completeRoom locks
          // all walls existing at seal time, so this only over-locks walls
          // drawn after the last seal — better than silently unlocking every
          // sealed room's walls).
          lockedWalls: new Set(
            saved.lockedWalls ??
            (saved.completedRoomSlots.length > 0 ? Object.keys(saved.walls) : []),
          ),
          doors: saved.doors,
          windows: saved.windows,
          jokerUsed: saved.jokerUsed,
          frontDoorEdge: saved.frontDoorEdge,
          gameFinished: saved.gameFinished,
          scenario,
          past: [],
          frontDoorMode: false,
          windowMode: false,
          demolishMode: false,
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
      const { activeRoomSlot, completedRoomSlots, placedPieces, doors } = get();
      if (activeRoomSlot === slot && !completedRoomSlots.has(slot)) return;
      if (activeRoomSlot && activeRoomSlot !== slot && !completedRoomSlots.has(activeRoomSlot)) {
        // Allow switching away from the active room only if the player hasn't
        // placed anything in it yet — they're still deciding which room to
        // start with. Once a piece lands the room is "in progress".
        const hasPlacedInActive = placedPieces.some((p) => p.roomSlot === activeRoomSlot);
        if (hasPlacedInActive) {
          set({
            lastError: `Finish Room ${activeRoomSlot} first — withdraw its pieces or seal it before switching to Room ${slot}.`,
          });
          return;
        }
      }
      // Re-entering a sealed room un-seals it so the player can revise walls,
      // demolish pieces, and place new furniture. The room's existing walls /
      // doors / placed pieces are preserved — only the "finished" flag drops.
      const wasSealed = completedRoomSlots.has(slot);
      // Smart wallPhase: when re-entering a sealed room that's still
      // sealable as-is (has its own door, OR the front door opens directly
      // into it), jump straight to 'door' phase so the player can re-Confirm
      // with one click. Brand-new selections and un-sealable rooms stay in
      // 'walls'.
      const myDoorCount = Object.values(doors).filter((r) => r === slot).length;
      const { scenario: sc, placedPieces: pp, walls: ws, frontDoorEdge: fd } = get();
      const frontDoorIsThisRoom = !!sc && frontDoorOpensIntoRoom(sc, pp, ws, fd, slot);
      const isSealable = myDoorCount === 1 || (myDoorCount === 0 && frontDoorIsThisRoom);
      const nextPhase: WallPhase = wasSealed && isSealable ? 'door' : 'walls';
      mutate(() => {
        const nextCompleted = new Set(completedRoomSlots);
        if (wasSealed) nextCompleted.delete(slot);
        set({
          activeRoomSlot: slot,
          completedRoomSlots: nextCompleted,
          wallPhase: nextPhase,
          gameFinished: wasSealed ? false : get().gameFinished,
          lastError: null,
        });
      });
    },

    autoRevealRoom: (slot) => {
      const { scenario, revealedCardKeys } = get();
      if (!scenario) return;
      const room = scenario.rooms.find((r) => r.slot === slot);
      if (!room) return;
      const next = new Set(revealedCardKeys);
      let changed = false;
      for (let i = 0; i < roomItemCount(room); i++) {
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
      const room = scenario?.rooms.find((r) => r.slot === slot) ?? null;
      const item = room ? roomItemAt(room, slotIdx) : null;
      if (!item) return;
      if (item.kind === 'named') {
        // The name pins the exact piece (variant + option). Card-derived entries
        // keep number/variant/option_index so the numbered pipeline still applies;
        // custom entries use number 0 (matches nothing) + source 'custom'.
        const e = furnitureByName(item.name);
        if (!e) return;
        mutate(() => set({
          selectedOption: {
            slot, slotIdx,
            name: e.name,
            source: e.source,
            number: e.number ?? 0,
            variant: e.variant ?? 'A',
            optionIndex: e.option_index ?? 1,
            rotation: 0,
            mirrored: false,
          },
          lastError: null,
        }));
        return;
      }
      const number = item.number;
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

    rotateSelection: (dir: 1 | -1 = 1) => {
      const s = get().selectedOption;
      if (!s) return;
      const next = (((s.rotation + (dir === -1 ? 3 : 1)) % 4) as Rotation);
      set({ selectedOption: { ...s, rotation: next } });
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
      audioManager.playSfx('place');
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

    // Free-selection palette: the player places the furniture they want in any
    // order; 「完成摆放」 marks every still-unresolved card as skipped, which
    // pushes currentCardIndexOf past the end → the room enters construction.
    // One undo step restores the whole pre-finish state.
    finishPlacing: () => {
      const { scenario, activeRoomSlot } = get();
      const room = scenario?.rooms.find((r) => r.slot === activeRoomSlot);
      if (!room || !activeRoomSlot) return;
      mutate(() => {
        const nextRevealed = new Set(get().revealedCardKeys);
        const nextSkipped = new Set(get().skippedCardKeys);
        for (let i = 0; i < roomItemCount(room); i++) {
          const k = instanceKey(activeRoomSlot, i);
          if (!get().placedCardKeys.has(k) && !nextSkipped.has(k)) {
            nextRevealed.add(k);
            nextSkipped.add(k);
          }
        }
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
        // Clear the in-progress selection for this card so its ghost doesn't
        // linger on the plan after skipping.
        const sel = get().selectedOption;
        const clearSel = !!sel && sel.slot === slot && sel.slotIdx === slotIdx;
        set({
          revealedCardKeys: nextRevealed,
          skippedCardKeys: nextSkipped,
          selectedOption: clearSel ? null : sel,
          lastError: null,
        });
      });
    },

    unskipCard: (slot, slotIdx) => {
      // Bring a skipped card back to a placeable state — useful when the
      // player re-enters a sealed room (it un-seals; demolish frees placed
      // cards but skip persists unless they explicitly un-skip).
      const key = instanceKey(slot, slotIdx);
      if (!get().skippedCardKeys.has(key)) return;
      mutate(() => {
        const nextSkipped = new Set(get().skippedCardKeys);
        nextSkipped.delete(key);
        set({ skippedCardKeys: nextSkipped, gameFinished: false, lastError: null });
      });
    },

    unplaceCard: (slot, slotIdx) => {
      // Withdraw a placed piece for this card instance from the floor plan,
      // same effect as demolishing it via the canvas but triggered from the
      // sidebar card. Drops the piece, frees the instance key, un-seals its
      // room AND un-skips every other skipped card in that room — see the
      // user-stated invariant: "removing furniture from a room reverts the
      // room to editing state, every card in the room becomes editable
      // until the room is finished again".
      const key = instanceKey(slot, slotIdx);
      const { placedPieces, placedCardKeys, completedRoomSlots, skippedCardKeys } = get();
      if (!placedCardKeys.has(key)) return;
      const newPieces = placedPieces.filter(
        (p) => !(p.slot === slot && p.slotIdx === slotIdx),
      );
      if (newPieces.length === placedPieces.length) return;   // nothing actually removed
      mutate(() => {
        const newPlacedKeys = new Set(placedCardKeys);
        newPlacedKeys.delete(key);
        const newCompleted = new Set(completedRoomSlots);
        newCompleted.delete(slot);
        const newSkipped = new Set(skippedCardKeys);
        for (const k of Array.from(newSkipped)) {
          const [s] = k.split(':');
          if (s === slot) newSkipped.delete(k);
        }
        set({
          placedPieces: newPieces,
          placedCardKeys: newPlacedKeys,
          completedRoomSlots: newCompleted,
          skippedCardKeys: newSkipped,
          gameFinished: false,
          lastError: null,
        });
      });
      audioManager.playSfx('remove');
    },

    toggleWall: (edgeKey) => {
      if (constructionLocked()) return;
      const { walls, doors, wallPhase, lockedWalls, scenario } = get();
      if (wallPhase !== 'walls') return;
      if (doors[edgeKey]) return;
      const isRemoving = !!walls[edgeKey];
      if (isRemoving && lockedWalls.has(edgeKey)) {
        // Sealed room's wall — not removable by a plain tap (use demolish mode).
        set({ lastError: '已完成房间的墙不能直接抹掉，请使用拆除模式。' });
        return;
      }
      // A player wall is an INTERIOR partition: both cells it separates must be
      // indoor. This forbids drawing on the building's exterior outline (one
      // side outdoor — already a wall) or out in the open (both sides outdoor).
      if (!isRemoving && scenario) {
        const [a, b] = edgeAdjacentCells(edgeKey);
        const aIn = isIndoorCell(scenario, a[0], a[1]);
        const bIn = isIndoorCell(scenario, b[0], b[1]);
        if (!aIn || !bIn) {
          set({
            lastError: aIn || bIn
              ? '不能和外墙重叠——内墙只能画在两格室内之间'
              : '不能在房间外面砌墙',
          });
          return;
        }
      }
      mutate(() => {
        const next = { ...walls };
        if (next[edgeKey]) delete next[edgeKey];
        else next[edgeKey] = true;
        set({ walls: next });
      });
      audioManager.playSfx(isRemoving ? 'remove' : 'place');
    },

    setDoor: (edgeKey) => {
      if (constructionLocked()) return;
      const { walls, doors, wallPhase, activeRoomSlot, placedPieces, lockedWalls } = get();
      if (wallPhase !== 'door' || !activeRoomSlot) return;
      if (!walls[edgeKey]) return;
      const isToggleOffEarly = doors[edgeKey] === activeRoomSlot;
      if (!isToggleOffEarly && lockedWalls.has(edgeKey)) {
        set({ lastError: '门只能开在当前房间的墙上' });
        return;
      }
      // Both cells flanking the door must be walkable — a door butted up
      // against a piece's shape is structurally blocked (no one can walk
      // through). Toggling OFF the current door is always allowed.
      const isToggleOff = doors[edgeKey] === activeRoomSlot;
      if (!isToggleOff) {
        const [a, b] = edgeAdjacentCells(edgeKey);
        const shapeCells = new Set<string>();
        for (const p of placedPieces) {
          for (const [r, c] of pieceShapeCells(p)) shapeCells.add(`${r},${c}`);
        }
        if (shapeCells.has(`${a[0]},${a[1]}`) || shapeCells.has(`${b[0]},${b[1]}`)) {
          set({ lastError: 'Both sides of a door must be open — one side is blocked by a furniture piece.' });
          return;
        }
      }
      mutate(() => {
        const nextDoors = { ...doors };
        if (isToggleOff) {
          delete nextDoors[edgeKey];
        } else {
          for (const key of Object.keys(nextDoors)) {
            if (nextDoors[key] === activeRoomSlot) delete nextDoors[key];
          }
          nextDoors[edgeKey] = activeRoomSlot;
        }
        set({ doors: nextDoors, lastError: null });
      });
      audioManager.playSfx(isToggleOff ? 'remove' : 'place');
    },

    setWallPhase: (phase) => {
      if (constructionLocked()) return;
      set({ wallPhase: phase, lastError: null });
    },

    toggleFrontDoorMode: () => {
      if (frontDoorLocked()) return;
      set({
        frontDoorMode: !get().frontDoorMode,
        windowMode: false,
        demolishMode: false,
        lastError: null,
      });
    },

    setFrontDoor: (edgeKey) => {
      if (frontDoorLocked()) return;
      const { scenario, placedPieces } = get();
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
            lastError: '该方案要求大门只能放在指定位置，请选择高亮的边。',
            frontDoorMode: false,
          });
          return;
        }
      }
      // The cells flanking the (possibly multi-cell-wide) front door must
      // stay walkable. If a piece's shape already occupies any of them,
      // refuse — otherwise the rulebook's "门带后面的 2 格必须保持空格"
      // rule would already be broken the moment the door is set.
      if (scenario) {
        const width = scenario.rules?.front_door?.width ?? 1;
        const collectAdj = (k: string): [number, number][] => {
          const [type, rStr, cStr] = k.split(':');
          const r = parseInt(rStr, 10);
          const c = parseInt(cStr, 10);
          return type === 'h'
            ? [[r - 1, c], [r, c]]
            : [[r, c - 1], [r, c]];
        };
        const adj: [number, number][] = [...collectAdj(edgeKey)];
        if (width >= 2) {
          const [t, rStr, cStr] = edgeKey.split(':');
          const fr = parseInt(rStr, 10);
          const fc = parseInt(cStr, 10);
          const forward = t === 'h' ? `h:${fr}:${fc + 1}` : `v:${fr + 1}:${fc}`;
          const backward = t === 'h' ? `h:${fr}:${fc - 1}` : `v:${fr - 1}:${fc}`;
          // Pick whichever neighbour exists in the building (try forward
          // first then backward — same fallback the renderer uses).
          const ascii = scenario.grid.ascii.replace(/\n+$/, '').split('\n');
          const isIndoor = (rr: number, cc: number) => {
            const ch = ascii[rr]?.[cc];
            return !!ch && scenario.grid.legend[ch]?.terrain === 'indoor';
          };
          const isExt = (k: string) => {
            const [t2, rs, cs] = k.split(':');
            const r2 = parseInt(rs, 10);
            const c2 = parseInt(cs, 10);
            return t2 === 'h'
              ? isIndoor(r2 - 1, c2) !== isIndoor(r2, c2)
              : isIndoor(r2, c2 - 1) !== isIndoor(r2, c2);
          };
          const ext = isExt(forward) ? forward : isExt(backward) ? backward : null;
          if (ext) adj.push(...collectAdj(ext));
        }
        const occupied = new Set<string>();
        for (const p of placedPieces) {
          for (const [r, c] of pieceShapeCells(p)) occupied.add(`${r},${c}`);
        }
        const blocker = adj.find(([rr, cc]) => occupied.has(`${rr},${cc}`));
        if (blocker) {
          set({
            lastError: `${blocker[0] + 1}${String.fromCharCode(65 + blocker[1])} 格被家具占据，大门后方必须保持空格，请先撤回该家具。`,
            frontDoorMode: false,
          });
          return;
        }
      }
      mutate(() => set({ frontDoorEdge: edgeKey, lastError: null }));
      set({ frontDoorMode: false });
      audioManager.playSfx('place');
    },

    toggleWindowMode: () => {
      if (constructionLocked()) return;
      set({
        windowMode: !get().windowMode,
        frontDoorMode: false,
        demolishMode: false,
        lastError: null,
      });
    },

    toggleDemolishMode: () => {
      if (constructionLocked()) return;
      set({
        demolishMode: !get().demolishMode,
        frontDoorMode: false,
        windowMode: false,
        selectedOption: null,
        lastError: null,
      });
    },

    demolishAtCell: ([targetR, targetC]) => {
      const { placedPieces, placedCardKeys, completedRoomSlots, activeRoomSlot } = get();
      // Find pieces whose SHAPE contains this cell. Open-space cells don't
      // count — clicking those is a no-op (per user rule).
      const hits: number[] = [];
      placedPieces.forEach((p, idx) => {
        if (pieceShapeCells(p).some(([r, c]) => r === targetR && c === targetC)) {
          hits.push(idx);
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
      const skippedCardKeys = get().skippedCardKeys;
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
        // Invariant (user-stated): removing furniture from a room reverts
        // that room to its editing state — every card in the room becomes
        // re-editable, INCLUDING ones previously marked SKIPPED. Without
        // this, demolishing a single piece left the player stuck: their
        // skipped cards never came back so they couldn't re-fill the room.
        const newSkipped = new Set(skippedCardKeys);
        for (const k of Array.from(newSkipped)) {
          const [s] = k.split(':');
          if (affectedRooms.has(s as RoomSlot)) newSkipped.delete(k);
        }
        set({
          placedPieces: newPieces,
          placedCardKeys: newPlacedKeys,
          completedRoomSlots: newCompleted,
          skippedCardKeys: newSkipped,
          gameFinished: false,
          lastError: null,
        });
      });
      audioManager.playSfx('remove');
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
        audioManager.playSfx('remove');
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
        audioManager.playSfx('remove');
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
          // Unlock the edge too — otherwise a wall later re-drawn here would
          // inherit the stale lock and could never be toggled off again.
          const nextLocked = new Set(get().lockedWalls);
          nextLocked.delete(edgeKey);
          set({
            walls: nextWalls,
            doors: nextDoors,
            lockedWalls: nextLocked,
            completedRoomSlots: newCompleted,
            gameFinished: false,
            lastError: null,
          });
        });
        audioManager.playSfx('remove');
      }
    },

    toggleWindow: (edgeKey) => {
      if (constructionLocked()) return;
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
      // Only the active room: the window's indoor-side cell must be in the
      // active room's region (so you can't add/remove windows on a sealed room).
      const { placedPieces, walls, activeRoomSlot } = get();
      const regionMap = computeRegions(scenario, walls);
      const activeReg = activeRoomSlot
        ? assignRoomsToRegions(placedPieces, regionMap).get(activeRoomSlot)
        : undefined;
      if (activeReg !== undefined) {
        const [type, rStr, cStr] = edgeKey.split(':');
        const er = parseInt(rStr, 10), ec = parseInt(cStr, 10);
        const cells = type === 'h' ? [[er - 1, ec], [er, ec]] : [[er, ec - 1], [er, ec]];
        let indoorReg: number | undefined;
        for (const [cr, cc] of cells) {
          const reg = regionMap.cellToRegion.get(`${cr},${cc}`);
          if (reg !== undefined) { indoorReg = reg; break; }
        }
        if (indoorReg !== activeReg) {
          set({ lastError: '只能在当前房间开窗' });
          return;
        }
      }
      const isRemoving = !!windows[edgeKey];
      mutate(() => {
        const next = { ...windows };
        if (next[edgeKey]) delete next[edgeKey];
        else next[edgeKey] = true;
        set({ windows: next, lastError: null });
      });
      audioManager.playSfx(isRemoving ? 'remove' : 'place');
    },

    setThemeId: (id) => set({ themeId: id }),

    setBgmMuted: (muted) => {
      set({ bgmMuted: muted });
      audioManager.setBgmMuted(muted);
      saveAudioSettings({ bgmMuted: muted, sfxMuted: get().sfxMuted });
    },

    setSfxMuted: (muted) => {
      set({ sfxMuted: muted });
      audioManager.setSfxMuted(muted);
      saveAudioSettings({ bgmMuted: get().bgmMuted, sfxMuted: muted });
    },

    finishGame: () => mutate(() => set({ gameFinished: true, lastError: null })),
    unfinishGame: () => mutate(() => set({ gameFinished: false })),

    completeRoom: () => {
      if (constructionLocked()) return false;
      const { activeRoomSlot, doors, scenario, placedPieces, walls, frontDoorEdge } = get();
      if (!activeRoomSlot) return false;
      const myDoors = Object.values(doors).filter((r) => r === activeRoomSlot).length;
      // Normal rule: each room needs exactly one door. Exception: if the
      // front door's indoor side falls inside this room's region, the
      // room doesn't need its own door (it doubles as the entrance lobby
      // — Castle Café's dining area uses this). 2+ doors is still wrong.
      const frontDoorIsThisRoom = !!scenario && frontDoorOpensIntoRoom(
        scenario, placedPieces, walls, frontDoorEdge, activeRoomSlot,
      );
      const okWithoutDoor = myDoors === 0 && frontDoorIsThisRoom;
      if (!(myDoors === 1 || okWithoutDoor)) {
        set({
          lastError: myDoors > 1
            ? `Room ${activeRoomSlot} has ${myDoors} doors — only one is allowed.`
            : 'Each room needs exactly one door before closing (unless the front door opens directly into this room).',
        });
        return false;
      }
      // Require the room to be enclosed: walls must divide the indoor area into
      // distinct regions. If the whole interior is still one region (no walls
      // separate this room from the rest), the room is not properly sealed.
      // Exception: single-room scenarios need no interior walls.
      if (scenario && scenario.rooms.length > 1) {
        const regionMap = computeRegions(scenario, walls);
        if (regionMap.regions.size < 2) {
          set({ lastError: '请先用墙将房间封闭，再完成该房间。' });
          return false;
        }
        // Every furniture piece in this room must:
        // (a) lie entirely within one region (no wall cuts through a piece), AND
        // (b) all pieces must be in the SAME region (no piece left outside the walls).
        const roomRegions = new Set<number>();  // one entry per piece (its region)
        for (const p of placedPieces.filter(pp => pp.slot === activeRoomSlot)) {
          const pieceRegions = new Set<number>();
          for (const [r, c] of pieceFootprintCells(p)) {
            const reg = regionMap.cellToRegion.get(`${r},${c}`);
            if (reg !== undefined) pieceRegions.add(reg);
          }
          if (pieceRegions.size > 1) {
            const opt = resolveOption(p);
            set({ lastError: `家具「${opt?.name_zh ?? `#${p.number}`}」被墙切开了，请调整墙的位置后再完成房间。` });
            return false;
          }
          for (const r of pieceRegions) roomRegions.add(r);
        }
        if (roomRegions.size > 1) {
          set({ lastError: '部分家具在墙外，请确保所有家具都被包裹在同一个墙围区域内。' });
          return false;
        }
      }
      mutate(() => {
        const nextCompleted = new Set(get().completedRoomSlots);
        nextCompleted.add(activeRoomSlot);
        // Once every room is sealed we DON'T auto-settle — instead we drop the
        // active room (activeRoomSlot → null), which puts the bottom panel into
        // its final "放大门 → 结算" stage. Scoring happens only when the player
        // presses 结算 (finishGame). Otherwise auto-advance to the next un-sealed
        // room so the furniture→construction loop continues without a picker.
        const allSealed = !!scenario && scenario.rooms.every((r) => nextCompleted.has(r.slot));
        const nextRoom = scenario?.rooms.find((r) => !nextCompleted.has(r.slot)) ?? null;
        // Lock this room's walls — they're done; the next room can't remove
        // them, recolour them, or put its door on them.
        const lockedWalls = new Set([...get().lockedWalls, ...Object.keys(get().walls)]);
        set({
          completedRoomSlots: nextCompleted,
          activeRoomSlot: allSealed ? null : (nextRoom?.slot ?? null),
          wallPhase: 'walls',
          windowMode: false,
          lockedWalls,
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
  };
});

// ────────────────────── selectors ──────────────────────

/** Every room in the scenario is sealed — the game is in its final
 *  "放大门 → 结算" stage (no active room left to build). */
export function allRoomsSealed(s: GameState): boolean {
  if (!s.scenario) return false;
  return s.scenario.rooms.every((r) => s.completedRoomSlots.has(r.slot));
}

/** The scenario fixes the front door to a single pre-drawn position — the
 *  player can't re-place it. */
export function frontDoorFixed(s: GameState): boolean {
  return !!s.scenario && autoFrontDoor(s.scenario) !== null;
}

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
  const count = roomItemCount(room);
  return Array.from({ length: count }, (_, i) => i).every((slotIdx) => {
    const key = instanceKey(slot, slotIdx);
    return state.placedCardKeys.has(key) || state.skippedCardKeys.has(key);
  });
}

// Convenience accessors for non-React consumers (Cocos Components).
export const getState  = () => gameStore.getState();
export const subscribe = gameStore.subscribe;
