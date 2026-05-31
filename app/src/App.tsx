import { useEffect, useState } from 'react';
import './App.css';
import { scenarioById, scenarios } from './data';
import { FloorPlan } from './components/FloorPlan';
import { RoomPanel } from './components/RoomPanel';
import { SelectionStatus } from './components/SelectionStatus';
import { WallModeBanner } from './components/WallModeBanner';
import { EndGameScreen } from './components/EndGameScreen';
import { FinishGameBanner } from './components/FinishGameBanner';
import { ReviewPanel } from './components/ReviewPanel';
import { BonusPanel } from './components/BonusPanel';
import { FloorPlanToolbar } from './components/FloorPlanToolbar';
import { Toolbar } from './components/Toolbar';
import { useGameStore } from './store/game';
import { loadSavedState } from './lib/persistence';
import { audioManager } from './lib/audio';
import { saveAudioSettings } from './lib/audioSettings';
import { useAudioUnlock } from './hooks/useAudioUnlock';

const AVAILABLE_SCENARIO_IDS = [
  'training',
  'alpine_wellness_hut',
  'mountain_surgery',
  'castle_cafe',
  'rehearsal_room_old_barn',
  'game_store_old_town',
];
const SCENARIO_STORAGE_KEY = 'current_scenario_id';
const DEFAULT_SCENARIO_ID = 'training';

function loadScenarioId(): string {
  const saved = localStorage.getItem(SCENARIO_STORAGE_KEY);
  if (saved && AVAILABLE_SCENARIO_IDS.includes(saved)) return saved;
  return DEFAULT_SCENARIO_ID;
}

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function App() {
  const [scenarioId, setScenarioId] = useState<string>(loadScenarioId);
  const scenario = scenarioById(scenarioId);
  const initRun = useGameStore((s) => s.initRun);
  const bgmMuted = useGameStore((s) => s.bgmMuted);
  const sfxMuted = useGameStore((s) => s.sfxMuted);

  // Init audio + push restored mute prefs (loaded by the store at init time)
  // into the audio manager. Runs once; audioManager is idempotent under
  // StrictMode double-mount.
  useEffect(() => {
    audioManager.init();
    const s = useGameStore.getState();
    audioManager.setBgmMuted(s.bgmMuted);
    audioManager.setSfxMuted(s.sfxMuted);
  }, []);

  // Mirror mute changes back to localStorage. First run writes the same
  // values just loaded by the store initializer — no clobber, no race.
  useEffect(() => {
    saveAudioSettings({ bgmMuted, sfxMuted });
  }, [bgmMuted, sfxMuted]);

  useAudioUnlock();

  const hash = useHashRoute();

  // Re-init the game store whenever the scenario changes. Fetch the
  // on-disk saved session (if any) for this scenario first, then hand it
  // to initRun synchronously. Switching scenarios loads its own save.
  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    (async () => {
      const saved = await loadSavedState(scenario.id);
      if (cancelled) return;
      initRun(scenario, saved);
    })();
    return () => { cancelled = true; };
  }, [scenario, initRun]);

  // Persist scenario choice.
  useEffect(() => {
    localStorage.setItem(SCENARIO_STORAGE_KEY, scenarioId);
  }, [scenarioId]);

  const changeScenario = (next: string) => {
    if (next === scenarioId) return;
    setScenarioId(next);   // each scenario has its own save slot, no prompt needed
  };

  if (hash === '#/review') {
    return <ReviewPanel />;
  }

  if (!scenario) {
    return <div className="app">Failed to load scenario: {scenarioId}</div>;
  }

  const availableScenarios = AVAILABLE_SCENARIO_IDS
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Verplant &amp; Zugestellt</h1>
          <p className="subtitle">
            <select
              className="scenario-picker"
              value={scenarioId}
              onChange={(e) => changeScenario(e.target.value)}
              title="Switch scenario — each scenario keeps its own auto-saved session"
            >
              {availableScenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id === 'training' ? '🎓 ' : ''}{s.title_zh} · {s.title_en}
                </option>
              ))}
            </select>
          </p>
        </div>
        <Toolbar />
      </header>
      <main className="app-main">
        <div className="sidebar">
          <RoomPanel rooms={scenario.rooms} />
        </div>
        <div className="floor-plan-area">
          <BonusPanel scenario={scenario} />
          <FinishGameBanner scenario={scenario} />
          <FloorPlanToolbar />
          <WallModeBanner scenario={scenario} />
          <SelectionStatus />
          <FloorPlan scenario={scenario} />
        </div>
      </main>
      <EndGameScreen scenario={scenario} />
    </div>
  );
}

export default App;
