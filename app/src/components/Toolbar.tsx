import { useEffect } from 'react';
import { useGameStore } from '../store/game';
import './Toolbar.css';

export function Toolbar() {
  const undo = useGameStore((s) => s.undo);
  const pastLen = useGameStore((s) => s.past.length);

  // Ctrl+Z / Cmd+Z handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  return (
    <div className="toolbar">
      <button
        type="button"
        className="undo-btn"
        onClick={undo}
        disabled={pastLen === 0}
        title="Undo (Ctrl+Z)"
      >
        ↶ Undo
        <span className="undo-count">{pastLen}</span>
      </button>
    </div>
  );
}
