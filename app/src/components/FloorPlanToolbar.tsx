// Compact toolbar that lives next to the floor plan — actions that mutate
// the plan (front door, undo) live closer to the canvas they affect.

import { useEffect, useState } from 'react';
import { useGameStore } from '../store/game';
import { clearSavedState, loadSavedState, saveState, makePersistedSnapshot } from '../lib/persistence';
import './FloorPlanToolbar.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'loading';

export function FloorPlanToolbar() {
  const undo = useGameStore((s) => s.undo);
  const pastLen = useGameStore((s) => s.past.length);
  const frontDoorEdge = useGameStore((s) => s.frontDoorEdge);
  const frontDoorMode = useGameStore((s) => s.frontDoorMode);
  const toggleFrontDoorMode = useGameStore((s) => s.toggleFrontDoorMode);
  const windowMode = useGameStore((s) => s.windowMode);
  const toggleWindowMode = useGameStore((s) => s.toggleWindowMode);
  const windowCount = useGameStore((s) => Object.keys(s.windows).length);
  const demolishMode = useGameStore((s) => s.demolishMode);
  const toggleDemolishMode = useGameStore((s) => s.toggleDemolishMode);
  const scenario = useGameStore((s) => s.scenario);
  const initRun = useGameStore((s) => s.initRun);
  const resetCurrentScenario = useGameStore((s) => s.resetCurrentScenario);
  const placedCount = useGameStore((s) => s.placedPieces.length);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveExists, setSaveExists] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Refresh "save exists" flag whenever scenario changes.
  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    loadSavedState(scenario.id).then((s) => {
      if (cancelled) return;
      setSaveExists(s !== null);
      setSavedAt(s?.ts ?? null);
    });
    return () => { cancelled = true; };
  }, [scenario]);

  const handleSave = async () => {
    if (!scenario) return;
    setSaveStatus('saving');
    const snapshot = makePersistedSnapshot(useGameStore.getState());
    await saveState(scenario.id, snapshot);
    setSaveStatus('saved');
    setSaveExists(true);
    setSavedAt(snapshot.ts);
    window.setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const handleLoad = async () => {
    if (!scenario) return;
    if (placedCount > 0) {
      const ok = confirm(
        `Discard current unsaved progress (${placedCount} placed piece(s)) and load the saved session?`,
      );
      if (!ok) return;
    }
    setSaveStatus('loading');
    const saved = await loadSavedState(scenario.id);
    if (!saved) {
      setSaveStatus('error');
      alert('No saved session for this scenario yet.');
      window.setTimeout(() => setSaveStatus('idle'), 1500);
      return;
    }
    initRun(scenario, saved);
    setSaveStatus('idle');
  };

  const handleReset = async () => {
    const msg = placedCount > 0
      ? `Clear the saved session for "${scenario?.title_zh}" and start over? (${placedCount} placed piece(s) will be discarded; other scenarios' saves stay intact)`
      : `Reset this scenario? (Re-roll furniture variants and clear walls / doors / windows.)`;
    if (!confirm(msg) || !scenario) return;
    await clearSavedState(scenario.id);
    resetCurrentScenario();
    setSaveExists(false);
    setSavedAt(null);
  };

  const saveLabel = saveStatus === 'saving' ? '💾 Saving…' : saveStatus === 'saved' ? '✓ Saved' : '💾 Save';
  const loadLabel = saveStatus === 'loading' ? '📂 Loading…' : '📂 Load';
  const savedAgo = savedAt
    ? `Saved ${new Date(savedAt).toLocaleString()}`
    : 'No save for this scenario yet';

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
        className={`fp-demolish-btn ${demolishMode ? 'active' : ''}`}
        onClick={toggleDemolishMode}
        title="Demolish mode — click a piece's shape cell to remove it, click a wall/door/window to remove it. Click again to exit."
      >
        ⛏ {demolishMode ? 'Click to demolish…' : 'Demolish'}
      </button>
      <button
        type="button"
        className={`fp-save-btn ${saveStatus === 'saved' ? 'just-saved' : ''}`}
        onClick={handleSave}
        disabled={saveStatus === 'saving' || saveStatus === 'loading'}
        title={`Write current state to md/saves/${scenario?.id ?? '?'}.json. ${savedAgo}`}
      >
        {saveLabel}
      </button>
      <button
        type="button"
        className="fp-load-btn"
        onClick={handleLoad}
        disabled={!saveExists || saveStatus === 'saving' || saveStatus === 'loading'}
        title={saveExists ? `Restore from saved file. ${savedAgo}` : 'No saved session for this scenario yet'}
      >
        {loadLabel}
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
