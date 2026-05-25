import type { Scenario } from '../types';
import { useGameStore } from '../store/game';
import './FinishGameBanner.css';

interface Props {
  scenario: Scenario;
}

/**
 * Always-visible progress checklist + finish button. Replaces the previous
 * "auto-finish when all rooms are sealed" behavior so the player decides when
 * to end the game and gets a clear reminder of what's still missing.
 */
export function FinishGameBanner({ scenario }: Props) {
  const completedRoomSlots = useGameStore((s) => s.completedRoomSlots);
  const frontDoorEdge = useGameStore((s) => s.frontDoorEdge);
  const gameFinished = useGameStore((s) => s.gameFinished);
  const finishGame = useGameStore((s) => s.finishGame);

  // Don't show the banner once the game is over — the score overlay handles it.
  if (gameFinished) return null;

  const missingRooms = scenario.rooms.filter((r) => !completedRoomSlots.has(r.slot));
  const frontDoorOk = !!frontDoorEdge;
  const allDone = missingRooms.length === 0 && frontDoorOk;

  return (
    <div className={`finish-banner ${allDone ? 'ready' : 'pending'}`}>
      <div className="finish-checklist">
        {scenario.rooms.map((r) => {
          const done = completedRoomSlots.has(r.slot);
          return (
            <span key={r.slot} className={`check-item ${done ? 'ok' : 'pending'}`}>
              {done ? '✓' : '○'} Room {r.slot} <em>({r.name_zh})</em>
            </span>
          );
        })}
        <span className={`check-item ${frontDoorOk ? 'ok' : 'pending'}`}>
          {frontDoorOk ? '✓' : '○'} Front door
        </span>
      </div>
      <button
        type="button"
        className="finish-btn"
        onClick={() => allDone && finishGame()}
        disabled={!allDone}
        title={
          allDone
            ? 'Calculate final score'
            : `Still missing: ${[
                ...missingRooms.map((r) => `Room ${r.slot}`),
                ...(frontDoorOk ? [] : ['Front door']),
              ].join(', ')}`
        }
      >
        {allDone ? '🏁 Finish & calculate score' : '🏁 Finish (not ready)'}
      </button>
    </div>
  );
}
