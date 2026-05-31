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
