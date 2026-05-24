import { useEffect } from 'react';
import './App.css';
import { scenarioById } from './data';
import { FloorPlan } from './components/FloorPlan';
import { RoomPanel } from './components/RoomPanel';
import { SelectionStatus } from './components/SelectionStatus';
import { WallModeBanner } from './components/WallModeBanner';
import { EndGameScreen } from './components/EndGameScreen';
import { Toolbar } from './components/Toolbar';
import { useGameStore } from './store/game';

const TRAINING_ID = 'training';

function App() {
  const scenario = scenarioById(TRAINING_ID);
  const initRun = useGameStore((s) => s.initRun);

  useEffect(() => {
    if (scenario) initRun(scenario);
  }, [scenario, initRun]);

  if (!scenario) {
    return <div className="app">Failed to load scenario: {TRAINING_ID}</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Verplant &amp; Zugestellt</h1>
          <p className="subtitle">
            {scenario.title_zh} · {scenario.title_en}
          </p>
        </div>
        <Toolbar />
      </header>
      <main className="app-main">
        <RoomPanel rooms={scenario.rooms} />
        <div className="floor-plan-area">
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
