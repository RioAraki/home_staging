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
