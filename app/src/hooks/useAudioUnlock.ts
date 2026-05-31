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
