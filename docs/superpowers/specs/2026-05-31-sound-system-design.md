# Sound System — Step 1 Design

Date: 2026-05-31
Status: Draft, pending implementation
Scope: Foundation layer of the sound system. Adds a single looping BGM track
plus one place / one remove sound effect that fire on every furniture, wall,
door, and window placement / demolition.

## Goals

- A single ambient BGM loops continuously while the app is open.
- Placing **any** furniture / wall / door / window plays a "place" SFX.
- Demolishing **any** furniture / wall / door / window plays a "remove" SFX.
- BGM and SFX have independent mute toggles; both persist across reloads.
- BGM defaults to ON, fades in silently on the player's first user gesture
  (browsers block autoplay until then).

## Non-Goals (deferred to later steps)

- UI button click / hover sounds.
- Card reveal / flip sounds.
- Scenario completion fanfare.
- Volume sliders (mute toggles only for Step 1).
- Multi-track BGM rotation / playlist.
- Per-furniture-category sound variation (heavy thud vs light clink).
- Spatialised / 3-D audio.

## Stack Decisions

- **Library:** Howler.js. Chosen over hand-rolled HTMLAudioElement because
  the standard cross-browser autoplay-unlock, sound pooling, and fade APIs
  pay for themselves vs. ~80 lines of hand-rolled wrapper, and we anticipate
  the audio surface to grow (future steps). ~7 KB gzip.
- **Trigger style:** Zustand store actions call `audioManager.playSfx(...)`
  directly. The store imports the audio module as a side-effect dependency.
  Rejected the alternatives (component `useEffect` diffing on `placedPieces`;
  Zustand subscribe middleware) because each action knows exactly which SFX
  fits and exactly when the action succeeded, eliminating diff bookkeeping
  and undo-confusion.
- **Asset host:** `app/public/sounds/`. Files are served statically and not
  bundled into the JS chunk, so changing a sound file does not invalidate
  the JS cache.

## File Layout

```
app/
├── public/
│   └── sounds/                       NEW
│       ├── bgm-ambient.mp3           CC0 ambient loop (~1–3 min, seamless)
│       ├── sfx-place.mp3             ~150 ms place cue
│       └── sfx-remove.mp3            ~120 ms remove cue
├── src/
│   ├── lib/
│   │   └── audio.ts                  NEW · singleton AudioManager
│   ├── hooks/
│   │   └── useAudioUnlock.ts         NEW · once-only gesture listener
│   ├── store/
│   │   └── game.ts                   MOD · mute state + SFX calls inside actions
│   ├── lib/
│   │   └── persistence.ts            MOD · mute flags in PersistedState
│   ├── components/
│   │   └── Toolbar.tsx               MOD · two mute buttons
│   └── App.tsx                       MOD · audioManager.init() + useAudioUnlock
└── package.json                      MOD · add howler + @types/howler
```

## AudioManager — Public API (lib/audio.ts)

```ts
audioManager.init()                    // preload all Howl instances
audioManager.startBgm()                // post-gesture fade-in entry point
audioManager.setBgmMuted(b: boolean)   // takes effect immediately
audioManager.setSfxMuted(b: boolean)
audioManager.playSfx('place' | 'remove')
```

Internals:
- One BGM `Howl` (`loop: true`, `html5: false` so it lives in WebAudio for
  smooth volume ramp).
- Two SFX `Howl` instances, each with `pool: 3` so rapid placements
  (player drops two pieces ~50 ms apart) layer cleanly without truncation.
- Fade-in duration: 600 ms on first `startBgm()` call.
- `setBgmMuted(true)` while BGM is playing: instant `.volume(0)`. Untoggling
  ramps back to full over 200 ms.
- `playSfx` is a no-op when SFX is muted. No queueing.
- `init()` and `startBgm()` are idempotent — second and subsequent calls
  are no-ops. Matters under React StrictMode's double-mount in dev and for
  any path that might re-trigger unlock.

## Zustand State (store/game.ts)

Two new non-undoable fields (peers of `demolishMode`):

```ts
bgmMuted: boolean         // default false (BGM on by default)
sfxMuted: boolean         // default false
toggleBgmMuted: () => void
toggleSfxMuted: () => void
```

Each `toggle` action:
1. Flips the boolean in state.
2. Calls `audioManager.setBgmMuted(next)` / `setSfxMuted(next)` in the same
   tick so the audio change is synchronous with the icon change.

## Persistence (lib/persistence.ts)

Add `bgmMuted` and `sfxMuted` to `PersistedState`. Reuses the existing
localStorage key — no new key, no migration needed (missing fields just
default to `false` on load).

On app mount in `App.tsx`:
1. `audioManager.init()`
2. Read persisted mute flags into the store (existing persistence path).
3. Push the restored values into `audioManager` so the manager and store
   start aligned.
4. Mount `useAudioUnlock`.

## First-Gesture Unlock (hooks/useAudioUnlock.ts)

Mounted once at the App level. On mount:

1. Register a one-shot listener for `pointerdown` and `keydown` on
   `window` with `{ once: true, passive: true }`.
2. First event fires → call `audioManager.startBgm()`. If `bgmMuted` is
   true, `startBgm()` still primes the BGM Howl at volume 0 so a later
   untoggle plays immediately.

## SFX Trigger Table

Every entry calls `audioManager.playSfx(...)` exactly once per action,
inside the success-mutate branch.

| Action | Code site (game.ts) | Condition | SFX |
|---|---|---|---|
| Place furniture | `placeSelected` | end of success branch | `place` |
| Withdraw furniture from sidebar | `unplaceCard` | end of success branch (real removal) | `remove` |
| Demolish furniture by canvas click | `demolishAtCell` | when `toRemove.length > 0` | `remove` (one shot even if multiple pieces removed) |
| Demolish wall / door / window / front door by canvas click | `demolishAtEdge` | any edge type actually deleted | `remove` (one shot even if wall+door cleared together) |
| Draw new wall | `toggleWall` | `walls[edgeKey]` was empty | `place` |
| Erase wall (toggle off) | `toggleWall` | `walls[edgeKey]` was set | `remove` |
| Place door | `setDoor` | `!isToggleOff` branch | `place` |
| Toggle off current door | `setDoor` | `isToggleOff` branch | `remove` |
| Place / replace front door | `setFrontDoor` | success branch | `place` (replacement is a single place, not place+remove) |
| Place window | `toggleWindow` | `windows[edgeKey]` was empty | `place` |
| Erase window | `toggleWindow` | `windows[edgeKey]` was set | `remove` |
| **Undo** | `undo()` | — | none |
| `skipCard`, `unskipCard`, `completeRoom`, `setWallPhase`, mode toggles | — | — | none |
| Any rejected operation (`lastError` set, state unchanged) | — | — | none |

## UI (components/Toolbar.tsx)

Two icon buttons added to the existing toolbar (placement TBD by visual fit
during implementation — author will eyeball it against the live toolbar):

- 🎵 / 🔇 (BGM mute / unmute) — toggles `bgmMuted`.
- 🔊 / 🔈 (SFX mute / unmute) — toggles `sfxMuted`.

Glyphs are simple inline SVGs (project pattern: see `public/icons.svg`).
Each button reads its boolean from the store so the icon swap is reactive.

## Error Handling / Degradation

- **Asset 404 / load error:** Howler `onloaderror` → `console.warn` once
  per channel; that channel becomes a silent no-op. Game continues normally.
- **Playback rejected by browser:** Howler `onplayerror` → log once, no
  retry, no UI surface.
- **No AudioContext:** older browsers without WebAudio degrade to HTML5
  fallback automatically via Howler. No extra code.

## Testing

- **Automated:** none for Step 1. jsdom lacks WebAudio; mocking Howler to
  the depth needed for meaningful assertions is high cost / low value.
- **Manual checklist** (run on `npm run dev`):
  1. Fresh load → no sound until first click; first click triggers BGM
     fade-in.
  2. Reload page → BGM still on (default), mute states restored.
  3. Click 🎵 → BGM silences instantly; click again → BGM ramps back.
  4. Click 🔊 → next place / remove is silent; click again → audible.
  5. Place a furniture card → `place` SFX.
  6. Withdraw from sidebar ↩ → `remove`.
  7. Drop 5 cards back-to-back fast → 5 distinct SFX (no truncation).
  8. Demolish mode → click furniture → `remove`. Click wall → `remove`.
     Click door → `remove`. Click window → `remove`. Click front door →
     `remove`. Click empty cell → no sound.
  9. Draw wall → `place`. Toggle same edge off → `remove`.
  10. Place door / window / front door → `place` for each.
  11. Place a piece that's rejected (overlap, out of bounds) → no sound.
  12. Undo a placement → no sound.
  13. Undo a chain of placements → no sound, ever.

## CC0 Asset Sourcing

- **BGM:** Ambient piano / crystal pad, 1–3 min seamless loop. Sources to
  evaluate: pixabay.com/music (filter: ambient, loopable), freesound.org
  (`license:"Creative Commons 0"`, query: `ambient piano loop`).
- **Place SFX:** Soft "click" / "tap" / "wood place", < 200 ms, no tail.
- **Remove SFX:** Soft "pop" / "whoosh-out", < 150 ms.
- Encode as 96–128 kbps mp3 to keep all three files combined under ~1 MB.

The implementation plan will list specific candidate URLs and final file
choices; this spec just commits to the licence (CC0 only) and rough shape.

## Open Questions

None at spec time. All edge-case decisions captured above:
- `undo` is silent.
- `setFrontDoor` that replaces an existing front door is a single `place`,
  not a `remove`+`place` pair.
- Batch demolitions (`demolishAtCell` removing multiple pieces, or
  `demolishAtEdge` clearing a wall+door together) play one `remove`.
- Rejected operations play nothing.
