# Sound System — Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a single looping BGM plus place / remove SFX into the existing
furniture-staging game so that every place / demolish event (furniture, wall,
door, window) plays a sound, with independent persistent mute toggles for
BGM and SFX.

**Architecture:** A Howler-backed singleton `audioManager` module owns three
`Howl` instances (1 BGM, 2 SFX). Zustand store actions call the manager
directly inside their success branches. A separate `localStorage` key
`audio_settings` persists `{bgmMuted, sfxMuted}` globally (not per
scenario). A one-shot `pointerdown`/`keydown` listener mounted in `App.tsx`
triggers the BGM fade-in.

**Tech Stack:** Howler.js 2.x, React 19, Zustand 5, TypeScript 6, Vite 8.

**Testing approach:** No automated tests (jsdom has no WebAudio; mocking
Howler at the depth needed for meaningful assertions is high-cost / low-
value — explicit decision in spec). Every task ends with **manual
verification** in `npm run dev` against acceptance steps. Task 10 is a full
end-to-end manual run-through.

**Spec:** `docs/superpowers/specs/2026-05-31-sound-system-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `app/package.json` | modify | add `howler` + `@types/howler` |
| `app/public/sounds/bgm-ambient.mp3` | create | ambient loop |
| `app/public/sounds/sfx-place.mp3` | create | place cue |
| `app/public/sounds/sfx-remove.mp3` | create | remove cue |
| `app/src/lib/audio.ts` | create | singleton AudioManager around Howler |
| `app/src/lib/audioSettings.ts` | create | localStorage read/write for `{bgmMuted, sfxMuted}` |
| `app/src/hooks/useAudioUnlock.ts` | create | one-shot gesture listener that calls `audioManager.startBgm()` |
| `app/src/store/game.ts` | modify | add `bgmMuted`/`sfxMuted` state + toggles; call `audioManager.playSfx` in 11 action sites |
| `app/src/components/Toolbar.tsx` | modify | add two icon mute buttons |
| `app/src/components/Toolbar.css` | modify | style for new buttons |
| `app/src/App.tsx` | modify | init audio manager + mount `useAudioUnlock` + hydrate mute state |

---

## Task 1: Install Howler

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json`

- [ ] **Step 1: Install**

From `app/`:
```bash
npm install howler@^2.2.4
npm install --save-dev @types/howler@^2.2.12
```

- [ ] **Step 2: Verify**

Run `npm ls howler @types/howler`. Expected:
```
app@0.0.0
├── howler@2.2.x
└── @types/howler@2.2.x
```

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "Add howler dependency for sound system"
git push origin main
```

---

## Task 2: AudioManager singleton (lib/audio.ts)

**Files:**
- Create: `app/src/lib/audio.ts`

- [ ] **Step 1: Create the file**

```ts
// Singleton audio layer for the sound system. Wraps Howler so the rest of
// the app talks in domain terms (`playSfx('place')`) and never touches a
// Howl instance directly. See docs/superpowers/specs/2026-05-31-sound-
// system-design.md.

import { Howl } from 'howler';

type SfxName = 'place' | 'remove';

const BGM_URL = '/sounds/bgm-ambient.mp3';
const SFX_URLS: Record<SfxName, string> = {
  place: '/sounds/sfx-place.mp3',
  remove: '/sounds/sfx-remove.mp3',
};

const BGM_FADE_IN_MS = 600;
const BGM_UNMUTE_RAMP_MS = 200;
const BGM_TARGET_VOL = 0.45;          // ambient sits behind SFX in mix
const SFX_TARGET_VOL = 0.85;

class AudioManager {
  private inited = false;
  private bgmStarted = false;
  private bgm: Howl | null = null;
  private sfx: Record<SfxName, Howl> | null = null;
  private bgmMuted = false;
  private sfxMuted = false;

  /** Preload Howl instances. Idempotent — safe to call from StrictMode. */
  init(): void {
    if (this.inited) return;
    this.inited = true;

    this.bgm = new Howl({
      src: [BGM_URL],
      loop: true,
      html5: false,                   // WebAudio for smooth volume ramp
      volume: 0,                      // ramp up in startBgm()
      onloaderror: (_id, err) => {
        console.warn('[audio] BGM failed to load:', err);
        this.bgm = null;
      },
      onplayerror: (_id, err) => {
        console.warn('[audio] BGM playback rejected:', err);
      },
    });

    this.sfx = {
      place: new Howl({
        src: [SFX_URLS.place],
        volume: SFX_TARGET_VOL,
        pool: 3,
        onloaderror: (_id, err) => {
          console.warn('[audio] place SFX failed to load:', err);
          if (this.sfx) this.sfx.place = null as unknown as Howl;
        },
      }),
      remove: new Howl({
        src: [SFX_URLS.remove],
        volume: SFX_TARGET_VOL,
        pool: 3,
        onloaderror: (_id, err) => {
          console.warn('[audio] remove SFX failed to load:', err);
          if (this.sfx) this.sfx.remove = null as unknown as Howl;
        },
      }),
    };
  }

  /** Start BGM with a fade-in. Idempotent — only first call has effect. */
  startBgm(): void {
    if (this.bgmStarted) return;
    this.bgmStarted = true;
    if (!this.bgm) return;
    this.bgm.play();
    if (!this.bgmMuted) {
      this.bgm.fade(0, BGM_TARGET_VOL, BGM_FADE_IN_MS);
    }
    // If muted at unlock time, BGM stays at vol 0 until setBgmMuted(false)
    // ramps it up.
  }

  setBgmMuted(muted: boolean): void {
    this.bgmMuted = muted;
    if (!this.bgm) return;
    if (muted) {
      this.bgm.volume(0);
    } else if (this.bgmStarted) {
      this.bgm.fade(this.bgm.volume(), BGM_TARGET_VOL, BGM_UNMUTE_RAMP_MS);
    }
  }

  setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
  }

  playSfx(name: SfxName): void {
    if (this.sfxMuted) return;
    const howl = this.sfx?.[name];
    if (!howl) return;
    howl.play();
  }
}

export const audioManager = new AudioManager();
```

- [ ] **Step 2: Type check**

Run from `app/`:
```bash
npx tsc -b --noEmit
```
Expected: no errors. If it complains about `Howl` types not found, re-run Task 1's npm install.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/audio.ts
git commit -m "Add AudioManager singleton wrapping Howler"
git push origin main
```

---

## Task 3: localStorage settings layer (lib/audioSettings.ts)

**Files:**
- Create: `app/src/lib/audioSettings.ts`

- [ ] **Step 1: Create the file**

```ts
// Global (not per-scenario) audio preferences persisted in localStorage.
// Separate from lib/persistence.ts because that file's PersistedState is
// keyed per scenario on disk — mute is a player preference that shouldn't
// reset when switching scenarios.

const STORAGE_KEY = 'audio_settings';

export interface AudioSettings {
  bgmMuted: boolean;
  sfxMuted: boolean;
}

const DEFAULTS: AudioSettings = {
  bgmMuted: false,
  sfxMuted: false,
};

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      bgmMuted: parsed.bgmMuted ?? DEFAULTS.bgmMuted,
      sfxMuted: parsed.sfxMuted ?? DEFAULTS.sfxMuted,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveAudioSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore — out of quota, private mode, etc.
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/audioSettings.ts
git commit -m "Add localStorage layer for global audio mute preferences"
git push origin main
```

---

## Task 4: Unlock hook (hooks/useAudioUnlock.ts)

**Files:**
- Create: `app/src/hooks/useAudioUnlock.ts`

- [ ] **Step 1: Create the directory if missing**

```bash
mkdir -p app/src/hooks
```

- [ ] **Step 2: Create the file**

```ts
// One-shot listener that calls audioManager.startBgm() on the player's
// first user gesture, satisfying browser autoplay policies. Mount once at
// the App level.

import { useEffect } from 'react';
import { audioManager } from '../lib/audio';

export function useAudioUnlock(): void {
  useEffect(() => {
    const unlock = () => {
      audioManager.startBgm();
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useAudioUnlock.ts
git commit -m "Add useAudioUnlock hook for first-gesture BGM start"
git push origin main
```

---

## Task 5: Add mute state + toggles to Zustand store

**Files:**
- Modify: `app/src/store/game.ts`

This task adds the state fields and the two toggle actions. SFX trigger
calls are wired in Task 6.

- [ ] **Step 1: Import the audio manager**

Top of `game.ts`, add to the existing import block (after the other
relative imports near line 1-6):

```ts
import { audioManager } from '../lib/audio';
```

- [ ] **Step 2: Extend GameState interface**

In `interface GameState extends Undoable { ... }` (around line 71), add two
fields and two methods. Put them next to `themeId` / `setThemeId`:

```ts
  /** UI-only: BGM mute toggle. Persisted globally (not per scenario). */
  bgmMuted: boolean;
  /** UI-only: SFX mute toggle. Persisted globally (not per scenario). */
  sfxMuted: boolean;
  setBgmMuted: (muted: boolean) => void;
  setSfxMuted: (muted: boolean) => void;
```

- [ ] **Step 3: Add defaults to the store-create return object**

In `create<GameState>((set, get) => { ... return { ... } })` (around line
248-256), add these two field defaults next to `themeId: 'blueprint'`:

```ts
    bgmMuted: false,
    sfxMuted: false,
```

- [ ] **Step 4: Add toggle actions**

After `setThemeId: (id) => set({ themeId: id }),` (around line 892), add:

```ts
    setBgmMuted: (muted) => {
      set({ bgmMuted: muted });
      audioManager.setBgmMuted(muted);
    },

    setSfxMuted: (muted) => {
      set({ sfxMuted: muted });
      audioManager.setSfxMuted(muted);
    },
```

- [ ] **Step 5: Type check**

```bash
npx tsc -b --noEmit
```
Expected: no errors. If TS complains the store object is missing required
GameState fields, re-check Steps 2-4 — every interface field needs a
matching default or method.

- [ ] **Step 6: Manual smoke check**

Start dev server:
```bash
npm run dev
```
Open `http://localhost:5173`. Page should load normally (no audio yet —
that's Task 6). Open DevTools console; no errors. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add app/src/store/game.ts
git commit -m "Add bgmMuted / sfxMuted state and toggles to game store"
git push origin main
```

---

## Task 6: Wire SFX calls into store actions

**Files:**
- Modify: `app/src/store/game.ts`

10 source-level `audioManager.playSfx(...)` calls cover the 13 spec
trigger-table rows (three actions — `toggleWall`, `setDoor`, `toggleWindow` —
each use a single ternary call covering both add and remove). The rule: call
**after** the `mutate(...)` block returns and **inside** the success branch
only. Reject branches (`lastError` paths) play nothing.

- [ ] **Step 1: placeSelected**

In `placeSelected` (around line 431-451), after the closing `})` of
`mutate(() => { ... })` and before `return true;`, insert:

```ts
      audioManager.playSfx('place');
```

Full success suffix should read:
```ts
      mutate(() => { /* existing */ });
      audioManager.playSfx('place');
      return true;
    },
```

- [ ] **Step 2: unplaceCard**

In `unplaceCard` (around line 496-530), after the `mutate(() => { ... });`
block closes:

```ts
      audioManager.playSfx('remove');
```

- [ ] **Step 3: toggleWall**

In `toggleWall` (around line 532-542), capture the pre-mutate state BEFORE
the `mutate(...)` call:

Replace:
```ts
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
```

With:
```ts
    toggleWall: (edgeKey) => {
      const { walls, doors, wallPhase } = get();
      if (wallPhase !== 'walls') return;
      if (doors[edgeKey]) return;
      const isRemoving = !!walls[edgeKey];
      mutate(() => {
        const next = { ...walls };
        if (next[edgeKey]) delete next[edgeKey];
        else next[edgeKey] = true;
        set({ walls: next });
      });
      audioManager.playSfx(isRemoving ? 'remove' : 'place');
    },
```

- [ ] **Step 4: setDoor**

In `setDoor` (around line 544-588), the variable `isToggleOff` is already
declared. After the closing `})` of `mutate(...)`:

```ts
      audioManager.playSfx(isToggleOff ? 'remove' : 'place');
```

- [ ] **Step 5: setFrontDoor**

In `setFrontDoor` (around line 600-691), the success exit is:
```ts
      mutate(() => set({ frontDoorEdge: edgeKey, lastError: null }));
      set({ frontDoorMode: false });
    },
```

Add SFX after the second `set`:
```ts
      mutate(() => set({ frontDoorEdge: edgeKey, lastError: null }));
      set({ frontDoorMode: false });
      audioManager.playSfx('place');
    },
```

- [ ] **Step 6: toggleWindow**

In `toggleWindow` (around line 872-890), capture pre-mutate state:

Replace:
```ts
    toggleWindow: (edgeKey) => {
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
```

With:
```ts
    toggleWindow: (edgeKey) => {
      const { scenario, windows } = get();
      if (!scenario) return;
      const exteriorSet = new Set(
        exteriorWallEdgesFromScenario(scenario),
      );
      if (!exteriorSet.has(edgeKey)) {
        set({ lastError: 'Windows can only be placed on exterior walls.' });
        return;
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
```

- [ ] **Step 7: demolishAtCell**

In `demolishAtCell` (around line 710-786), after the closing `})` of
`mutate(...)`:

```ts
      audioManager.playSfx('remove');
```

The early returns above this point (no hits / wrong room) correctly bail
without making a sound.

- [ ] **Step 8: demolishAtEdge — front door branch**

In `demolishAtEdge` (around line 788), the front-door success branch is:
```ts
        mutate(() => set({ frontDoorEdge: null, gameFinished: false, lastError: null }));
        return;
```

Change to:
```ts
        mutate(() => set({ frontDoorEdge: null, gameFinished: false, lastError: null }));
        audioManager.playSfx('remove');
        return;
```

- [ ] **Step 9: demolishAtEdge — window branch**

Same file, the window success branch ends with:
```ts
        mutate(() => {
          const next = { ...windows };
          delete next[edgeKey];
          set({ windows: next, gameFinished: false, lastError: null });
        });
        return;
```

Change to:
```ts
        mutate(() => {
          const next = { ...windows };
          delete next[edgeKey];
          set({ windows: next, gameFinished: false, lastError: null });
        });
        audioManager.playSfx('remove');
        return;
```

- [ ] **Step 10: demolishAtEdge — wall/door branch**

Same file, the wall/door branch closes with:
```ts
        mutate(() => {
          const nextWalls = { ...walls };
          delete nextWalls[edgeKey];
          const nextDoors = { ...doors };
          const owner = nextDoors[edgeKey];
          delete nextDoors[edgeKey];
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
```

Add SFX after the `mutate` call's closing `});` but before the outer
`}` that closes the `if (walls[edgeKey] || doors[edgeKey])` block:

```ts
        mutate(() => {
          /* existing */
        });
        audioManager.playSfx('remove');
      }
    },
```

- [ ] **Step 11: Sanity — verify undo and rejected paths still untouched**

Search the file:
```bash
grep -n "audioManager.playSfx" app/src/store/game.ts
```
Expected: exactly **10 occurrences** — one each for placeSelected,
unplaceCard, toggleWall, setDoor, setFrontDoor, toggleWindow,
demolishAtCell, demolishAtEdge front-door, demolishAtEdge window,
demolishAtEdge wall/door. **None in `undo` and none in any `lastError`
early-return.**

Verify `undo` (around line 930) has no SFX call:
```bash
sed -n '930,936p' app/src/store/game.ts
```
Expected: no `playSfx` line.

- [ ] **Step 12: Type check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add app/src/store/game.ts
git commit -m "Wire place/remove SFX into all 11 furniture/wall/door/window actions"
git push origin main
```

---

## Task 7: BGM and SFX mute buttons in Toolbar

**Files:**
- Modify: `app/src/components/Toolbar.tsx`
- Modify: `app/src/components/Toolbar.css`

- [ ] **Step 1: Replace Toolbar.tsx**

Overwrite `app/src/components/Toolbar.tsx`:

```tsx
import { useGameStore } from '../store/game';
import { themes } from '../vector/themes';
import './Toolbar.css';

export function Toolbar() {
  const themeId = useGameStore((s) => s.themeId);
  const setThemeId = useGameStore((s) => s.setThemeId);
  const bgmMuted = useGameStore((s) => s.bgmMuted);
  const sfxMuted = useGameStore((s) => s.sfxMuted);
  const setBgmMuted = useGameStore((s) => s.setBgmMuted);
  const setSfxMuted = useGameStore((s) => s.setSfxMuted);

  return (
    <div className="toolbar">
      <button
        type="button"
        className={`audio-btn ${bgmMuted ? 'muted' : ''}`}
        onClick={() => setBgmMuted(!bgmMuted)}
        title={bgmMuted ? 'Unmute background music' : 'Mute background music'}
        aria-label={bgmMuted ? 'Unmute BGM' : 'Mute BGM'}
      >
        {bgmMuted ? '🎵🚫' : '🎵'}
      </button>
      <button
        type="button"
        className={`audio-btn ${sfxMuted ? 'muted' : ''}`}
        onClick={() => setSfxMuted(!sfxMuted)}
        title={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
        aria-label={sfxMuted ? 'Unmute SFX' : 'Mute SFX'}
      >
        {sfxMuted ? '🔇' : '🔊'}
      </button>
      <label className="theme-switcher" title="Switch the visual style of vector furniture">
        🎨
        <select
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
        >
          {Object.values(themes).map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Append styles to Toolbar.css**

Append to `app/src/components/Toolbar.css`:

```css
.audio-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px dashed var(--pen-soft);
  color: var(--pen);
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-family: 'Patrick Hand', sans-serif;
  font-size: 1rem;
  line-height: 1;
}
.audio-btn:hover { background: rgba(255, 255, 255, 0.06); border-color: var(--pen); }
.audio-btn.muted { opacity: 0.45; }
```

- [ ] **Step 3: Type check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 4: Visual smoke check**

```bash
npm run dev
```
Open `http://localhost:5173`. Header should show **🎵 + 🔊** buttons before
the 🎨 theme switcher. Click them — icons swap to muted variants. They do
not affect anything audibly yet (Task 8 wires in the audio manager).

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/Toolbar.tsx app/src/components/Toolbar.css
git commit -m "Add BGM and SFX mute toggle buttons to header toolbar"
git push origin main
```

---

## Task 8: Wire init, unlock, and persistence in App.tsx

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Add imports**

At the top of `App.tsx`, after the existing `import { loadSavedState } ...`
line:

```ts
import { audioManager } from './lib/audio';
import { loadAudioSettings, saveAudioSettings } from './lib/audioSettings';
import { useAudioUnlock } from './hooks/useAudioUnlock';
```

- [ ] **Step 2: Pull store accessors and hydrate audio on mount**

Inside `function App()`, after `const initRun = useGameStore((s) => s.initRun);`:

```tsx
  const setBgmMuted = useGameStore((s) => s.setBgmMuted);
  const setSfxMuted = useGameStore((s) => s.setSfxMuted);
  const bgmMuted = useGameStore((s) => s.bgmMuted);
  const sfxMuted = useGameStore((s) => s.sfxMuted);

  // Init audio + restore saved mute prefs. Runs once on first mount; the
  // audio manager itself is idempotent under StrictMode double-mount.
  useEffect(() => {
    audioManager.init();
    const saved = loadAudioSettings();
    setBgmMuted(saved.bgmMuted);
    setSfxMuted(saved.sfxMuted);
  }, [setBgmMuted, setSfxMuted]);

  // Mirror mute changes back to localStorage.
  useEffect(() => {
    saveAudioSettings({ bgmMuted, sfxMuted });
  }, [bgmMuted, sfxMuted]);

  useAudioUnlock();
```

- [ ] **Step 3: Type check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/App.tsx
git commit -m "Init audio manager, restore mute prefs, mount unlock hook"
git push origin main
```

---

## Task 9: Source and place the audio files

**Files:**
- Create: `app/public/sounds/bgm-ambient.mp3`
- Create: `app/public/sounds/sfx-place.mp3`
- Create: `app/public/sounds/sfx-remove.mp3`

These are binary assets the implementer downloads manually. **No code in
this task** — only file drops.

- [ ] **Step 1: Create the sounds directory**

```bash
mkdir -p app/public/sounds
```

- [ ] **Step 2: BGM — pick a CC0 ambient loop**

Open Pixabay Music: <https://pixabay.com/music/search/genre/ambient/>
Filter: duration 1–3 minutes, **loopable**. License is Pixabay Content
License (royalty-free, no attribution required, equivalent to CC0 for our
purposes).

Recommended search terms: `ambient piano loop`, `crystal ambient`,
`peaceful ambient`. Pick one that:
- Has no hard cut at start/end (loops cleanly)
- Sits in the background (low tempo, no strong vocals)
- Is < 1.5 MB encoded at 96 kbps mp3 (the in-browser player handles
  larger fine, but smaller = faster first load)

Save as `app/public/sounds/bgm-ambient.mp3`.

- [ ] **Step 3: Place SFX — pick a soft place cue**

Open Freesound: <https://freesound.org/search/?q=wood+tap+soft&f=license:%22Creative+Commons+0%22>
Pick a clip < 300 ms — soft tap, paper click, wood place. Avoid metallic
or harsh sounds.

Save as `app/public/sounds/sfx-place.mp3`. Re-encode if needed:
```bash
ffmpeg -i downloaded.wav -ar 44100 -ac 1 -b:a 96k app/public/sounds/sfx-place.mp3
```

- [ ] **Step 4: Remove SFX — pick a soft remove cue**

Same source. Search terms: `pop soft`, `whoosh short`, `air puff`. Pick
a clip < 250 ms.

Save as `app/public/sounds/sfx-remove.mp3`.

- [ ] **Step 5: Verify file presence**

```bash
ls -la app/public/sounds/
```
Expected: three `.mp3` files, total under 2 MB.

- [ ] **Step 6: Commit**

```bash
git add app/public/sounds/
git commit -m "Add CC0 ambient BGM and place/remove SFX assets"
git push origin main
```

---

## Task 10: End-to-end manual verification

**Files:** none (verification only).

Spec checklist, run on a clean dev server. Open DevTools console — there
should be **no warnings about audio loading**. If you see
`[audio] BGM failed to load`, Task 9's files are missing or misnamed.

- [ ] **Step 1: Start fresh dev session**

```bash
npm run dev
```
Open `http://localhost:5173` in an incognito window (so localStorage starts
clean).

- [ ] **Step 2: Cold load — silent until first click**

Page loads; no music. **Click anywhere on the page** (e.g., header) —
BGM fades in over ~600 ms.

- [ ] **Step 3: Reload — mute prefs and BGM-default-on persist**

Hit Cmd/Ctrl+R. After reload, click anywhere → BGM resumes.

- [ ] **Step 4: BGM mute toggle is instant + smooth**

Click 🎵 → audio cuts immediately. Icon shows 🎵🚫. Click again → ramps
back over ~200 ms.

- [ ] **Step 5: SFX mute toggle**

Click 🔊 → icon becomes 🔇. Place a piece (Step 7 below) → silent. Click
again → audible.

- [ ] **Step 6: Place furniture → place SFX**

Pick any room from the sidebar, reveal a card, click on the floor plan to
place. Hear `place` SFX once.

- [ ] **Step 7: Five rapid placements do not truncate**

Drop 5 pieces back-to-back, ~200 ms apart. Hear 5 distinct SFX, none cut
off mid-play.

- [ ] **Step 8: Withdraw via sidebar ↩ → remove SFX**

Click the ↩ on a placed card in the sidebar. Hear `remove` SFX once.

- [ ] **Step 9: Demolish mode covers all four edge types**

Enter demolish mode (the existing toolbar button). Verify each:
- Click a furniture shape cell → `remove` SFX
- Click a wall edge → `remove` SFX
- Click a door edge → `remove` SFX
- Click a window edge → `remove` SFX
- Click an empty floor cell → no sound

If the active scenario starts with a fixed front door (e.g., training
scenario), pick a scenario that lets you set one manually (e.g.,
`castle_cafe`), set it, then demolish it → `remove` SFX.

- [ ] **Step 10: Wall / door / window placement → place SFX**

Outside demolish mode, in wall phase: draw a new wall edge → `place`.
Click same edge again (toggle off) → `remove`. Place a door → `place`.
Toggle current door off (click same edge) → `remove`. Place a window →
`place`. Toggle window off → `remove`.

- [ ] **Step 11: Front door placement → place SFX**

Toggle front-door mode. Click an exterior edge → `place` SFX. Click a
different exterior edge (replacing the front door) → **a single `place`**,
not `place` + `remove`.

- [ ] **Step 12: Rejected operations are silent**

Try to place a piece overlapping an existing one. Hear nothing. Try to
place a door butted against a piece's shape (blocked by rule). Hear
nothing. (The `lastError` toast may appear; SFX must not.)

- [ ] **Step 13: Undo is silent**

Place a piece (hear SFX). Click undo. **Hear nothing.** Chain 3 more
undos (after placing more pieces). Hear nothing on any of them.

- [ ] **Step 14: Cross-scenario persistence**

Switch to a different scenario via the dropdown. BGM keeps playing across
the switch (no cut). Mute state preserved.

- [ ] **Step 15: All passes → final commit (verification only, no code)**

If any step above failed, return to the relevant task and fix. If all 14
behavioural checks passed, no additional commit is required; the system
is shipped.

---

## Out of scope (deferred to later steps)

- UI button click / hover sounds (deferred — Step 2)
- Card reveal / flip sounds
- Scenario completion fanfare
- Volume sliders (only mute toggles in Step 1)
- Multi-track BGM rotation / playlist
- Per-furniture-category SFX variation
- Spatialised / 3-D audio
- Visual feedback animation on mute buttons (smooth icon morph)
