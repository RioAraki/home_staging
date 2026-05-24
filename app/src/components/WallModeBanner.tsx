import { useGameStore, isRoomReadyToSeal } from '../store/game';
import { validateWallTopology } from '../lib/walls';
import type { Scenario } from '../types';
import './WallModeBanner.css';

interface Props { scenario: Scenario }

export function WallModeBanner({ scenario }: Props) {
  const activeRoomSlot = useGameStore((s) => s.activeRoomSlot);
  const chosenVariants = useGameStore((s) => s.chosenVariants);
  const placedCardKeys = useGameStore((s) => s.placedCardKeys);
  const skippedCardKeys = useGameStore((s) => s.skippedCardKeys);
  const walls = useGameStore((s) => s.walls);
  const doors = useGameStore((s) => s.doors);
  const wallPhase = useGameStore((s) => s.wallPhase);
  const setWallPhase = useGameStore((s) => s.setWallPhase);
  const completeRoom = useGameStore((s) => s.completeRoom);
  const setError = useGameStore((s) => s.setError);
  const lastError = useGameStore((s) => s.lastError);

  if (!activeRoomSlot) return null;
  const ready = isRoomReadyToSeal(
    scenario,
    { chosenVariants, placedCardKeys, skippedCardKeys },
    activeRoomSlot,
  );
  if (!ready) return null;

  const topology = validateWallTopology(scenario, walls);
  const wallCount = Object.keys(walls).length;
  const myDoorCount = Object.values(doors).filter((r) => r === activeRoomSlot).length;
  const room = scenario.rooms.find((r) => r.slot === activeRoomSlot);

  const handleNext = () => {
    if (!topology.ok) {
      setError(`Walls must be continuous — ${topology.danglingWalls.length} dangling edge(s) found. Fix them before placing a door.`);
      return;
    }
    setWallPhase('door');
  };

  const handleConfirm = () => {
    // Re-check topology in case walls were modified after switching phases
    if (!topology.ok) {
      setError(`Walls must be continuous — ${topology.danglingWalls.length} dangling edge(s) found.`);
      return;
    }
    completeRoom();
  };

  return (
    <div className="wall-banner">
      <div className="wall-banner-text">
        <strong>Room {activeRoomSlot} {room?.name_zh}</strong> furniture done.
        {wallPhase === 'walls' ? (
          <> Phase 1 — click cell edges to draw walls (must connect at both ends).</>
        ) : (
          <> Phase 2 — click any wall to make it this room's door (only one).</>
        )}
      </div>
      <div className="wall-banner-stats">
        <span className={topology.ok ? '' : 'bad-stat'}>
          walls: {wallCount}{!topology.ok && ` (${topology.danglingWalls.length} dangling)`}
        </span>
        <span className="door-stat">my door: {myDoorCount}/1</span>
      </div>
      <div className="wall-banner-actions">
        {wallPhase === 'walls' ? (
          <button
            type="button"
            className="phase-next-btn"
            onClick={handleNext}
            disabled={wallCount === 0}
          >
            Next: pick door →
          </button>
        ) : (
          <>
            <button
              type="button"
              className="phase-back-btn"
              onClick={() => setWallPhase('walls')}
            >
              ← Back to walls
            </button>
            <button type="button" className="confirm-room-btn" onClick={handleConfirm}>
              ✓ Confirm room
            </button>
          </>
        )}
      </div>
      {lastError && <div className="wall-banner-error">{lastError}</div>}
    </div>
  );
}
