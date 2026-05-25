// Compact toolbar that lives next to the floor plan — actions that mutate
// the plan (front door, undo) live closer to the canvas they affect.

import { useEffect } from 'react';
import { useGameStore } from '../store/game';
import './FloorPlanToolbar.css';

export function FloorPlanToolbar() {
  const undo = useGameStore((s) => s.undo);
  const pastLen = useGameStore((s) => s.past.length);
  const frontDoorEdge = useGameStore((s) => s.frontDoorEdge);
  const frontDoorMode = useGameStore((s) => s.frontDoorMode);
  const toggleFrontDoorMode = useGameStore((s) => s.toggleFrontDoorMode);
  const scenario = useGameStore((s) => s.scenario);

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
