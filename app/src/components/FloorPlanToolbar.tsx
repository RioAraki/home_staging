// Compact toolbar that lives next to the floor plan — actions that mutate
// the plan (front door, undo) live closer to the canvas they affect.

import { useEffect } from 'react';
import { useGameStore } from '../store/game';
import { clearSavedState } from '../lib/persistence';
import './FloorPlanToolbar.css';

export function FloorPlanToolbar() {
  const undo = useGameStore((s) => s.undo);
  const pastLen = useGameStore((s) => s.past.length);
  const frontDoorEdge = useGameStore((s) => s.frontDoorEdge);
  const frontDoorMode = useGameStore((s) => s.frontDoorMode);
  const toggleFrontDoorMode = useGameStore((s) => s.toggleFrontDoorMode);
  const windowMode = useGameStore((s) => s.windowMode);
  const toggleWindowMode = useGameStore((s) => s.toggleWindowMode);
  const windowCount = useGameStore((s) => Object.keys(s.windows).length);
  const scenario = useGameStore((s) => s.scenario);
  const resetCurrentScenario = useGameStore((s) => s.resetCurrentScenario);
  const placedCount = useGameStore((s) => s.placedPieces.length);

  const handleReset = async () => {
    const msg = placedCount > 0
      ? `Clear the saved session for "${scenario?.title_zh}" and start over? (${placedCount} placed piece(s) will be discarded; other scenarios' saves stay intact)`
      : `Reset this scenario? (Re-roll furniture variants and clear walls / doors / windows.)`;
    if (!confirm(msg) || !scenario) return;
    await clearSavedState(scenario.id);
    resetCurrentScenario();
  };

  // Front door is "fixed by scenario" when pre_drawn has exactly one
  // target=front_door entry — the store auto-sets it on init, button locks.
  const fixedFrontDoors = (scenario?.pre_drawn?.doors ?? []).filter(
    (d) => d.target === 'front_door',
  );
  const frontDoorLocked = fixedFrontDoors.length === 1;

  // Ctrl+Z / Cmd+Z still binds undo.
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

  const frontDoorLabel = frontDoorLocked
    ? '🚪 Fixed by scenario'
    : frontDoorMode
    ? '🚪 Click an exterior edge…'
    : frontDoorEdge
    ? '🚪 Move front door'
    : '🚪 Set front door';

  return (
    <div className="floorplan-toolbar">
      <button
        type="button"
        className={`fp-front-door-btn ${frontDoorMode ? 'active' : ''} ${frontDoorEdge ? 'set' : 'unset'} ${frontDoorLocked ? 'locked' : ''}`}
        onClick={toggleFrontDoorMode}
        disabled={frontDoorLocked}
        title={
          frontDoorLocked
            ? 'This scenario fixes the front door — cannot be moved'
            : "Designate one exterior wall edge as the building's front door"
        }
      >
        {frontDoorLabel}
      </button>
      <button
        type="button"
        className={`fp-window-btn ${windowMode ? 'active' : ''}`}
        onClick={toggleWindowMode}
        title="Toggle window placement mode — click any exterior wall edge to add / remove a window"
      >
        🪟 {windowMode ? 'Click an exterior edge…' : `Windows (${windowCount})`}
      </button>
      <button
        type="button"
        className="fp-reset-btn"
        onClick={handleReset}
        title="Reset this scenario — clears placed furniture, walls, doors, windows and re-rolls variants. Other scenarios' saves are kept."
      >
        🗑 Reset scenario
      </button>
      <button
        type="button"
        className="fp-undo-btn"
        onClick={undo}
        disabled={pastLen === 0}
        title="Undo (Ctrl+Z)"
      >
        ↶ Undo
        <span className="fp-undo-count">{pastLen}</span>
      </button>
    </div>
  );
}
