import { sys } from 'cc';

const KEY = 'audio_settings_v1';

export function loadAudioSettings(): { bgmMuted: boolean; sfxMuted: boolean } {
  try {
    const raw = sys.localStorage.getItem(KEY);
    if (!raw) return { bgmMuted: false, sfxMuted: false };
    return JSON.parse(raw);
  } catch { return { bgmMuted: false, sfxMuted: false }; }
}

export function saveAudioSettings(s: { bgmMuted: boolean; sfxMuted: boolean }) {
  try { sys.localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
