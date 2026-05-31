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
  private sfx: Record<SfxName, Howl | null> | null = null;
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
          if (this.sfx) this.sfx.place = null;
        },
      }),
      remove: new Howl({
        src: [SFX_URLS.remove],
        volume: SFX_TARGET_VOL,
        pool: 3,
        onloaderror: (_id, err) => {
          console.warn('[audio] remove SFX failed to load:', err);
          if (this.sfx) this.sfx.remove = null;
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
