import { useGameStore } from '../store/game';
import { themes } from '../vector/themes';
import './Toolbar.css';

export function Toolbar() {
  const themeId = useGameStore((s) => s.themeId);
  const setThemeId = useGameStore((s) => s.setThemeId);

  return (
    <div className="toolbar">
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
