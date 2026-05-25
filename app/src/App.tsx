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
import { saveState, type PersistedState } from './lib/persistence';

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
  const hash = useHashRoute();

  // Re-init the game store whenever the scenario changes. initRun internally
  // restores the per-scenario saved session if one exists, so this acts as
  // "load" — switching scenarios doesn't discard work.
  useEffect(() => {
    if (scenario) initRun(scenario);
  }, [scenario, initRun]);

  // Persist scenario choice.
  useEffect(() => {
    localStorage.setItem(SCENARIO_STORAGE_KEY, scenarioId);
  }, [scenarioId]);

  // Auto-save: on every store mutation, debounce ~250ms and write the
  // current state to per-scenario localStorage. Each scenario has its own
  // save slot — switching never destroys the others.
  useEffect(() => {
    let timer: number | null = null;
    const unsub = useGameStore.subscribe((state) => {
      if (!state.scenario) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const snapshot: PersistedState = {
          v: 1,
          ts: Date.now(),
          chosenVariants: state.chosenVariants,
          activeRoomSlot: state.activeRoomSlot,
          completedRoomSlots: Array.from(state.completedRoomSlots),
          revealedCardKeys: Array.from(state.revealedCardKeys),
          placedCardKeys: Array.from(state.placedCardKeys),
          skippedCardKeys: Array.from(state.skippedCardKeys),
          placedPieces: state.placedPieces,
          walls: state.walls,
          doors: state.doors,
          windows: state.windows,
          jokerUsed: state.jokerUsed,
          frontDoorEdge: state.frontDoorEdge,
          gameFinished: state.gameFinished,
        };
        saveState(state.scenario.id, snapshot);
      }, 250);
    });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsub();
    };
  }, []);

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
