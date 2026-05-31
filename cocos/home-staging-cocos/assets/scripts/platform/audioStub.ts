// Stub audio manager — same surface as Howler-backed audio.ts.
// Replaced with real AudioSource wrapper in Task 14.
export const audioManager = {
  init() { /* no-op */ },
  playSfx(_kind: 'place' | 'remove' | 'error') { /* no-op */ },
  setBgmMuted(_muted: boolean) { /* no-op */ },
  setSfxMuted(_muted: boolean) { /* no-op */ },
};

export const loadAudioSettings = () => ({ bgmMuted: false, sfxMuted: false });
export const saveAudioSettings = (_: { bgmMuted: boolean; sfxMuted: boolean }) => {};
