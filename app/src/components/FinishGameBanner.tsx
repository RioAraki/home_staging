import { useMemo } from 'react';
import type { Scenario } from '../types';
import { useGameStore } from '../store/game';
import { analyseAccessibility, findOrphanRegions, isRoomAccessible } from '../lib/regions';
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
  const placedPieces = useGameStore((s) => s.placedPieces);
  const walls = useGameStore((s) => s.walls);
  const doors = useGameStore((s) => s.doors);

  // Building-level checks: front door must be set, AND all rooms must be
  // sealed before orphan detection is meaningful. While rooms are still
  // being built, walled-off pockets are allowed (they may become future
  // rooms — e.g. Castle Café's no-hallway rule).
  const allRoomsSealed = completedRoomSlots.size === scenario.rooms.length;
  const { orphanCount, unreachableRooms } = useMemo(() => {
    if (!frontDoorEdge) return { orphanCount: 0, unreachableRooms: [] };
    const access = analyseAccessibility(scenario, placedPieces, walls, doors, frontDoorEdge);
    const orphans = allRoomsSealed ? findOrphanRegions(access, true).regionIds.length : 0;
    const bad = scenario.rooms
      .filter((r) => completedRoomSlots.has(r.slot) && !isRoomAccessible(access, r.slot))
      .map((r) => r.slot);
    return { orphanCount: orphans, unreachableRooms: bad };
  }, [scenario, placedPieces, walls, doors, frontDoorEdge, completedRoomSlots, allRoomsSealed]);

  // Don't show the banner once the game is over — the score overlay handles it.
  if (gameFinished) return null;

  const missingRooms = scenario.rooms.filter((r) => !completedRoomSlots.has(r.slot));
  const frontDoorOk = !!frontDoorEdge;
  const noOrphans = orphanCount === 0;
  const allRoomsReachable = unreachableRooms.length === 0;
  const allDone =
    missingRooms.length === 0 && frontDoorOk && noOrphans && allRoomsReachable;

  const missingBits: string[] = [];
  if (missingRooms.length > 0) missingBits.push(...missingRooms.map((r) => `Room ${r.slot}`));
  if (!frontDoorOk) missingBits.push('Front door');
  if (!noOrphans) missingBits.push(`${orphanCount} isolated region(s)`);
  if (!allRoomsReachable) missingBits.push(`Rooms unreachable: ${unreachableRooms.join(', ')}`);

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
        {frontDoorOk && allRoomsSealed && (
          <span className={`check-item ${noOrphans ? 'ok' : 'pending'}`}>
            {noOrphans ? '✓' : '✗'} No isolated regions
            {!noOrphans && ` (${orphanCount})`}
          </span>
        )}
        {frontDoorOk && missingRooms.length === 0 && (
          <span className={`check-item ${allRoomsReachable ? 'ok' : 'pending'}`}>
            {allRoomsReachable ? '✓' : '✗'} All rooms reachable from front door
            {!allRoomsReachable && ` (missing: ${unreachableRooms.join(',')})`}
          </span>
        )}
      </div>
      <button
        type="button"
        className="finish-btn"
        onClick={() => allDone && finishGame()}
        disabled={!allDone}
        title={
          allDone
            ? 'Calculate final score'
            : `Still missing: ${missingBits.join(', ')}`
        }
      >
        {allDone ? '🏁 Finish & calculate score' : '🏁 Finish (not ready)'}
      </button>
    </div>
  );
}
