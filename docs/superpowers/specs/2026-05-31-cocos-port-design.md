# Cocos Creator Port — v1 Design

Date: 2026-05-31
Status: Approved (user authorized skipping review gate; proceed to writing-plans)
Scope: Port the existing React + Vite web game (`app/`) to a Cocos Creator
3.x project (`cocos/`) targeting **mobile portrait + touch** as the
eventual delivery surface (WeChat Mini Game), with browser preview as the
v1 completion bar.

## 1. Goal

Validate that Cocos Creator can host this game's core mechanics, end-to-end
on a single scenario, with the full gameplay loop including walls, doors,
scoring, demolish, undo, and audio. Browser preview at 60fps on a desktop
+ mobile emulator counts as v1 done. WeChat Mini Game packaging and the
remaining 5 scenarios are **post-v1**.

## 2. Constraints

- **Target platform**: WeChat Mini Game (eventually). Browser preview is
  the v1 completion bar.
- **Form factor**: Mobile portrait, single-finger primary.
- **Design resolution**: 750 × 1334, FitHeight policy.
- **Tech**: Cocos Creator 3.8.x LTS, TypeScript, Zustand reused from the
  React project.
- **Working directory**: `D:\github\home_staging\cocos\` alongside the
  existing `app\` (same git repo). YAML data sources in `md\` remain
  authoritative for both projects.

## 3. v1 Scope

### In scope
- Single scenario: `training`
- Reveal cards → select option → rotate / mirror → drag to grid → place
- Walls + doors + windows + front door (full topology & validation)
- Demolish mode
- Undo (100-step snapshot stack)
- Bonus evaluation + EndGame screen
- Audio (BGM + place / remove / error SFX); mute persisted to
  `sys.localStorage`
- Pan + zoom on the FloorPlan (touch pinch + mouse wheel)

### Out of scope (post-v1)
- 5 other scenarios + scenario picker
- localStorage save / load per scenario
- Vector furniture rendering + theme switch
- Review panel
- Bilingual UI (Chinese only in v1)
- WeChat Mini Game packaging + the 4MB first-package limit work
  (asset compression, CDN, subpackages)

## 4. Repository Layout

```
D:\github\home_staging\
├── app\                   # existing React project (untouched)
├── md\                    # YAML data sources (shared)
│   ├── furniture_data.yaml
│   └── maps_data.yaml
└── cocos\                 # new Cocos project (this work)
    ├── assets\
    │   ├── data\          # JSON output of yaml2json (gitignored or built)
    │   ├── images\cards\  # 132 option JPGs copied from app\public\cards\options
    │   ├── prefabs\
    │   ├── scenes\Main.scene
    │   └── scripts\
    │       ├── core\      # near-verbatim ports from app\src\lib + types
    │       ├── state\     # gameStore.ts (Zustand port)
    │       ├── platform\  # audio.ts, audioSettings.ts
    │       └── ui\        # Cocos Component classes
    └── tools\yaml2json.cjs   # one-shot data converter
```

## 5. Architecture

**Hybrid prefab + code-driven approach**:
- Static UI scaffold (header, panels, toolbar, banners) authored as nodes
  in the editor scene.
- Dynamic content (card list items, placed pieces, ghost preview, grid
  graphics) created by code at runtime.
- Stateless rendering: each UI Component subscribes to a slice of the
  Zustand store and self-redraws on diff.

### Data flow
```
[input] → [store mutation] → [subscribers redraw their layer]

gameStore (Zustand vanilla):
  - state: selectedOption, placedPieces, walls, doors, windows,
           frontDoorEdge, wallPhase, jokerUsed, completedRoomSlots,
           past (undo stack), ... (same shape as React store)
  - actions: revealCard, selectOption, placeSelected, toggleWall,
             setDoor, demolish*, undo, ...
  - subscribers: every UI Component calls gameStore.subscribe() in
                 onLoad() and unsubscribes in onDestroy()
```

### Zustand reuse
- Zustand's vanilla API (`createStore` from `zustand/vanilla`) is
  DOM-free and runs in Cocos.
- Cocos Components read with `gameStore.getState()` and observe with
  `gameStore.subscribe((s, prev) => ...)`.
- Risk: Zustand under WeChat Mini Game's module loader. **Validate
  early** (see §11 risk #1).

## 6. Scene Node Tree (Main.scene)

```
Canvas
├── HeaderBar               [editor-static]
├── Sidebar (bottom strip)  [editor-scaffold]
│   ├── RoomTabs            [code: 5 tabs from scenario.rooms]
│   └── CardList            [ScrollView + horizontal Layout]
│       └── CardItem Prefab × N  [code-instantiated]
├── MainArea
│   ├── Toolbar             [editor: 6 buttons]
│   ├── WallModeBanner      [editor; show/hide on wallPhase change]
│   ├── SelectionStatus     [editor + ↻ / ⇋ / ✕ buttons]
│   ├── PanZoomContainer    [code-driven gesture container]
│   │   └── FloorPlan
│   │       ├── GridBg          [Graphics]
│   │       ├── PreDrawnLayer   [Graphics]
│   │       ├── PlacedLayer     [container; Sprite children]
│   │       ├── WallsLayer      [Graphics]
│   │       ├── DoorsLayer      [Graphics, includes arc symbol]
│   │       ├── WindowsLayer    [Graphics]
│   │       ├── GhostLayer      [Sprite, transient]
│   │       └── InputCatcher    [transparent, full-area touch]
│   └── BonusPanel          [editor scaffold + dynamic rows]
├── ModalLayer              [hidden by default]
│   ├── EndGameScreen
│   └── ErrorToast
└── AudioRoot               [3 AudioSource: BGM, place, remove]
```

## 7. Rendering Strategy (FloorPlan)

**Single Graphics node per layer + math-based hit detection.**
Rationale: mobile draw-call budget; hit-slop flexibility; no
pre-allocated 800 cell/edge nodes.

- GridBg / PreDrawnLayer / WallsLayer / DoorsLayer / WindowsLayer: each
  one Graphics node, redrawn on relevant state change.
- PlacedLayer: container; each placed piece = one Sprite child node
  (~30 max per scenario, acceptable cost).
- GhostPiece: one Sprite, position updated every TOUCH_MOVE.
- InputCatcher: transparent full-area node receiving TOUCH_*; computes
  cell vs edge by math.

### Hit-detection math
```
mx, my = touch position in FloorPlan local coords
cellX = floor(mx / cellSize), cellY = floor(my / cellSize)
localX = mx - cellX * cellSize, localY = my - cellY * cellSize
distToEdge = min(localX, cellSize - localX, localY, cellSize - localY)

if distToEdge < 12pt:
    → edge hit (nearest of top/right/bottom/left)
    → emit toggleWall / setDoor / toggleWindow / setFrontDoor
        depending on current mode
else:
    → cell hit at (cellX, cellY)
    → emit placeSelected or demolishAtCell depending on mode
```

12pt is the initial hit-slop; tune in §11 stage 15.

## 8. Script Inventory

### A. Direct port (~1500 LOC, copy with import path edits)
- `types.ts`, `geometry.ts`, `walls.ts`, `regions.ts`, `scoring.ts`,
  `validation.ts` → `assets/scripts/core/`

### B. Port with minor edits (~1200 LOC)
- `store/game.ts` → `assets/scripts/state/gameStore.ts`
  - Remove React-specific imports (none present today, but verify)
  - Replace `audioManager` import path
  - Remove `loadSavedState` / persistence side effects
  - Keep snapshot/undo, all mutate logic, all actions
- `lib/audio.ts` (Howler) → `assets/scripts/platform/audio.ts`
  (Cocos AudioSource)
  - **Public API identical**: `playSfx('place' | 'remove' | 'error')`,
    `setBgmMuted()`, `setSfxMuted()`, `init()`
  - Store call sites stay unchanged
- `lib/audioSettings.ts` → uses `sys.localStorage`
- `data/index.ts` → `core/dataLoader.ts` (loads JSON via `resources.load`)

### C. Rewrite (~3000 LOC React → ~2000 LOC Cocos)
- `App.tsx` → `GameRoot.ts`
- `RoomPanel.tsx` + `Card.tsx` → `RoomPanel.ts` + `CardItem.ts` prefab
- `FloorPlan.tsx` (1200+ LOC) → `FloorPlan.ts` + `InputHandler.ts` +
  `LayerRenderer.ts` (split to keep files under ~400 LOC each)
- `Toolbar.tsx` + `FloorPlanToolbar.tsx` → `Toolbar.ts` prefab
- `SelectionStatus.tsx` → `SelectionStatus.ts` prefab **with rotate/mirror buttons**
- `BonusPanel.tsx`, `EndGameScreen.tsx`, `WallModeBanner.tsx`,
  `FinishGameBanner.tsx` → corresponding `.ts` prefabs

### D. New (~600 LOC, Cocos-specific)
- `PanZoomContainer.ts`: single-finger pan + two-finger pinch + mouse
  wheel zoom, with gesture-conflict resolution (see §10)
- `InputHandler.ts`: cell vs edge hit detection
- `LayerRenderer.ts`: utilities for drawing grid lines, walls, doors,
  windows into Graphics nodes
- `GhostPiece.ts`: transient sprite + transform sync
- `tools/yaml2json.cjs`: build-time YAML → JSON converter

### Deleted
- `FurnitureShape.tsx` + entire `vector/` subtree (~1200 LOC).
  Furniture renders as raster Sprite from the option image set.
- `useAudioUnlock.ts`: Cocos AudioSource doesn't need a user-gesture
  unlock.
- `persistence.ts`: out of v1 scope.

## 9. Touch UX Specifications

### Screen layout (750 × 1334, FitHeight)
```
y=0
[ safe area top: 88pt ]
[ HeaderBar: 60pt ]            (title + mute toggle)
[ FloorPlan / PanZoom: ~640pt ] (≈ 41pt per cell at 1x zoom)
[ SelectionStatus: 56pt ]      (status text + ↻ ⇋ ✕ buttons)
[ CardList: 180pt ]            (horizontal scroll)
[ Toolbar: 64pt ]              (6 mode buttons)
[ BonusPanel summary: 56pt ]
[ safe area bottom: 68pt ]
y=1334
```

### Core placement gesture
```
1. Tap card → reveals (shows options)
2. Tap option → store.selectOption; ghost spawns at default position
3. Drag ghost with finger → snaps to cell under finger
4. Release:
   - legal: store.placeSelected + play 'place' SFX + card collapses
   - illegal: ghost flashes red + vibrate 50ms + toast lastError;
              ghost stays put (does NOT spring back)
5. While ghost active: tap ↻ rotates, tap ⇋ mirrors
6. Tap ✕ in SelectionStatus to cancel selection
```

### Mode buttons (Toolbar)
| Button | Action | Visual |
|---|---|---|
| 🚪 前门 | `toggleFrontDoorMode` | depressed state + banner |
| 🪟 窗 | `toggleWindowMode` | depressed + banner |
| 💣 拆除 | `toggleDemolishMode` | depressed + cursor tint |
| ↶ | `undo()` | momentary |
| ✓ 房 | `completeRoom()` | momentary |
| 🏁 | `finishGame()` | momentary, modal afterwards |

Mode buttons are mutually exclusive; activating one cancels the others
and clears any `selectedOption`.

### Wall / door interaction
- Default state: `wallPhase = 'walls'`. Tap edge → toggle wall.
- After wall layout: user taps "next phase" button → `wallPhase = 'door'`.
  Tap edge → setDoor.
- Wall phase auto-resets to 'walls' on room change.

### PanZoom gestures
- Single finger on empty area (not on ghost, not in edge/cell hit range
  during selection) → pan; max ±200pt offset, springs back if exceeded.
- Two-finger pinch → scale ∈ [0.6, 2.5], pivot = midpoint.
- Mouse wheel → scale (desktop).
- Double-tap empty area → reset pan + zoom.
- 200ms touch-start delay before committing to pan/tap to allow a second
  finger to upgrade gesture to pinch.

### No rotation gestures
Rotation and mirror are button-only. No two-finger rotation due to
pinch conflict and discoverability.

### Feedback
- Place success: `sfx-place` + ghost morphs to placed sprite.
- Place fail: ghost flashes red + `sys.vibrate(50)` (desktop: visual
  shake) + error toast.
- Demolish: `sfx-remove` + 100ms fade-out.
- Wall/door toggle: reuse place/remove SFX.

## 10. Gesture Conflict Resolution

The FloorPlan area handles up to four overlapping input semantics:
ghost drag, pan, pinch zoom, cell/edge tap. Disambiguation rules:

1. **If `selectedOption` is set and touch begins on the ghost** → drag
   ghost. Pan/pinch suppressed for this touch.
2. **If a second finger lands within 200ms** of touch start → cancel
   pending action, enter pinch.
3. **Single finger, no selection, movement > 8pt** → pan.
4. **Single finger, no selection, no movement / quick release** → tap;
   run hit detection (cell vs edge).
5. **CardList scroll vs CardItem tap**: CardItem's touch handler returns
   `true` only if movement stays under 8pt; otherwise it releases to the
   parent ScrollView.

## 11. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Zustand may not bundle cleanly under the WeChat Mini Game module loader. | Smoke-test the WeChat DevTools build at the END of stage 3 (not stage 15) — see §13. If broken, swap for a 100-LOC PubSub. |
| 2 | Gesture conflicts (ghost drag vs pan vs pinch) | Stage 5 includes a "ghost + pan combo" test before building further. |
| 3 | 750×1334 FitHeight crops on 9:21 narrow Android | Stage 15 real-device validation; fallback FitWidth + larger bottom strip. |
| 4 | 9.8MB of card JPGs blow the 4MB Mini Game first-package budget | Browser preview unaffected. Post-v1: webp conversion + CDN remote load + subpackages. |
| 5 | YAML schema drift between React and Cocos projects | yaml2json.cjs runs from a git pre-commit hook that fires whenever `md/*.yaml` changes. |
| 6 | scoring.ts bonus conditions depend on chair_count / cell_features metadata that may be incomplete in YAML | Stage 12 hand-verifies 2-3 training-scenario bonuses against expected scores. |
| 7 | Howler features used by audio.ts that AudioSource doesn't expose (fade, queue) | Stage 13 audits Howler usage in audio.ts; document gaps. |

## 12. Stage Plan (15 stages, ~2.5–3 calendar weeks)

| # | Stage | Verification | Est |
|---|---|---|---|
| 0 | Create Cocos project, set resolution, install Zustand. | Editor opens, empty scene runs. | 0.5h |
| 1 | yaml2json.cjs + copy card images to assets. | Console logs training scenario grid. | 0.5d |
| 2 | Copy core/ files (types, geometry, walls, regions, scoring, validation). Add 5 geometry unit tests. | Test suite passes 5 rotate/mirror cases. | 1d |
| 3 | Port gameStore.ts. Stub audio/persistence to no-ops. | Editor console: manual store actions mutate state correctly. **Plus** WeChat DevTools build smoke test (risk #1 early gate). | 1d |
| 4 | FloorPlan static render: grid + indoor/outdoor + pre-drawn markers. | Browser shows training floor plan, non-interactive. | 1d |
| 5 | PanZoomContainer: single-finger pan + mouse wheel zoom. (Pinch deferred to real-device stage.) | Desktop pan + zoom smooth, no flicker. **Plus** ghost-drag + pan conflict test stub. | 1d |
| 6 | RoomPanel + CardItem prefab, bottom horizontal scroll. | Tap card reveals; tap option updates SelectionStatus. | 1d |
| 7 | GhostPiece + placeSelected. Drag-snap mechanic. Illegal-placement feedback. | **Core loop runs end-to-end** for the first time. | 1.5d |
| 8 | Rotate / mirror buttons on SelectionStatus; ghost updates live. | Rotate-4-times returns to identity; mirror+rotate combinations correct. | 0.5d |
| 9 | InputHandler hit-slop math. Edge taps when no selection. | Tap edge in wall phase → toggleWall. | 1d |
| 10 | Walls + doors: Graphics rendering, wallPhase state machine, completeRoom. | Can fully seal a room with one door. | 2d |
| 11 | Front door / window / demolish mode buttons + banners. | All three modes mutually exclusive; visual feedback correct. | 1d |
| 12 | BonusPanel live updates + EndGameScreen modal. | Full game-end flow shows scoring breakdown. | 1d |
| 13 | audio.ts AudioSource wrapper; BGM + 3 SFX; mute via sys.localStorage. | Audio plays; mute survives reload. | 0.5d |
| 14 | Undo button wired to store.undo(). | 100 ops undo without crash. | 0.5h |
| 15 | Add pinch zoom + real-device polish (Chrome iPhone emulator + WeChat DevTools sanity). | All Hard checklist items in §14 pass; pinch works on touch device. | 1d |

## 13. Early WeChat Gate (risk #1 mitigation)

After stage 3 (gameStore ported) — before sinking time into UI rewrites —
do a short detour:
1. Build Cocos project for WeChat Mini Game target.
2. Open the build output in WeChat DevTools.
3. Confirm Zustand module loads and `gameStore.getState()` works from
   console.

If broken: pause UI work, replace Zustand with a hand-rolled
~100-LOC PubSub store that keeps the same `getState/subscribe` API.
Cost: 1 day. All downstream work unaffected because the API surface stays
identical.

## 14. Done Criteria

Hard (all required):
- [ ] Chrome desktop + iPhone emulator both run smoothly at ~60fps with
      ≤ 10 placed pieces.
- [ ] Full training-scenario playthrough possible with both
      mouse-on-desktop and finger-on-emulator.
- [ ] One full playthrough = ≥ 1 sealed room + non-zero score + EndGame
      screen.
- [ ] Rotate 4× returns piece to identity. Verify with asymmetric piece
      (e.g. `#5A small table with plant`).
- [ ] Illegal placement keeps ghost in place with red flash + toast;
      does NOT silently snap.
- [ ] Undo 100 ops without crash.
- [ ] BGM + SFX play; mute state survives page reload.
- [ ] Zero JS errors / warnings in console during a complete playthrough.

Soft (preferred but optional):
- [ ] WeChat DevTools opens and runs (performance not required).
- [ ] EndGameScreen lists each bonus condition and hit/miss state.
- [ ] All error toast copy in Chinese.

## 15. Deferred to v2+

- 5 remaining scenarios + scenario picker UI
- localStorage save/load per scenario
- Vector theme switch (FurnitureVector + themes/)
- Review panel + hash routing
- Bilingual UI
- Image compression (webp), CDN remote loading, subpackage layout for
  WeChat Mini Game's 4MB first-package limit
- WeChat Mini Game account registration, certification, submission
- Monetization (ads, IAP)
