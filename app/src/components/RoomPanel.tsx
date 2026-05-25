import { useState, useEffect } from 'react';
import type { Room, RoomSlot } from '../types';
import { useGameStore, instanceKey } from '../store/game';
import { Card } from './Card';
import './RoomPanel.css';

interface RoomPanelProps {
  rooms: Room[];
}

export function RoomPanel({ rooms }: RoomPanelProps) {
  const activeRoomSlot = useGameStore((s) => s.activeRoomSlot);
  const completedRoomSlots = useGameStore((s) => s.completedRoomSlots);
  const chosenVariants = useGameStore((s) => s.chosenVariants);
  const skippedCardKeys = useGameStore((s) => s.skippedCardKeys);
  const placedCardKeys = useGameStore((s) => s.placedCardKeys);
  const placedPieces = useGameStore((s) => s.placedPieces);
  const demolishMode = useGameStore((s) => s.demolishMode);
  const skipCard = useGameStore((s) => s.skipCard);
  const selectRoom = useGameStore((s) => s.selectRoom);
  const autoRevealRoom = useGameStore((s) => s.autoRevealRoom);

  // Other rooms are "locked" only when the active room has at least one
  // placed piece — until then the player can freely jump between rooms to
  // decide where to start.
  const activeHasPieces =
    activeRoomSlot !== null &&
    placedPieces.some((p) => p.roomSlot === activeRoomSlot);

  // Per-room collapse state. Rooms auto-collapse when they finish, and the
  // player can manually expand/collapse via the ⌃/⌄ toggle on the header.
  const [collapsed, setCollapsed] = useState<Set<RoomSlot>>(new Set());
  useEffect(() => {
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const slot of completedRoomSlots) {
        if (!next.has(slot)) {
          next.add(slot);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [completedRoomSlots]);
  const toggleCollapse = (slot: RoomSlot) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const otherRoomActive = (slot: string) =>
    activeRoomSlot !== null &&
    activeRoomSlot !== slot &&
    !completedRoomSlots.has(activeRoomSlot) &&
    activeHasPieces;

  return (
    <aside className="room-panel">
      <h2 className="room-panel-title">Rooms</h2>
      <ul className="room-list">
        {rooms.map((room) => {
          const isActive = activeRoomSlot === room.slot;
          const isCompleted = completedRoomSlots.has(room.slot);
          const isLocked = otherRoomActive(room.slot) || isCompleted;
          const stateLabel = isCompleted
            ? '✓ done'
            : isActive
            ? '• active'
            : isLocked
            ? 'locked'
            : 'select';
          // Count duplicates for an "× N" hint on multi-copy cards
          const numberCounts = room.furniture_numbers.reduce<Record<number, number>>(
            (m, n) => ({ ...m, [n]: (m[n] ?? 0) + 1 }),
            {},
          );
          const isCollapsed = collapsed.has(room.slot);
          // Force-expanded when active: you can't seal a room without seeing
          // its cards. Otherwise honour the collapse toggle.
          const showDetails = isActive ? true : !isCollapsed;
          return (
            <li
              key={room.slot}
              className={`room-item ${isActive ? 'active' : ''} ${
                isLocked ? 'locked' : ''
              } ${isCompleted ? 'completed' : ''} ${isCollapsed ? 'collapsed' : ''}`}
            >
              <div className="room-header-row">
                <button
                  type="button"
                  className="room-header"
                  onClick={() => {
                    selectRoom(room.slot);
                    autoRevealRoom(room.slot);
                  }}
                  disabled={isLocked && !isActive}
                >
                  <span className="room-slot">{room.slot}</span>
                  <span className="room-name">
                    {room.name_zh} <span className="room-name-en">({room.name_en})</span>
                  </span>
                  <span className="room-state">{stateLabel}</span>
                </button>
                <button
                  type="button"
                  className="room-collapse-btn"
                  onClick={(e) => { e.stopPropagation(); toggleCollapse(room.slot); }}
                  disabled={isActive}
                  title={
                    isActive ? 'Active room — always shown' :
                    isCollapsed ? 'Show furniture' : 'Hide furniture'
                  }
                >
                  {isCollapsed ? '⌄' : '⌃'}
                </button>
              </div>
              {showDetails && (
              <div className="room-cards">
                {room.furniture_numbers.map((num, slotIdx) => {
                  const variant = chosenVariants[num] ?? 'A';
                  const dupTotal = numberCounts[num];
                  // For multi-copy, compute which-of-N this instance is.
                  // E.g. 3rd copy of #13 → "(3/3)". Single copies show no hint.
                  let copyOf = 0;
                  if (dupTotal > 1) {
                    for (let j = 0; j <= slotIdx; j++) {
                      if (room.furniture_numbers[j] === num) copyOf += 1;
                    }
                  }
                  return (
                    <div key={`${room.slot}:${slotIdx}`} className="card-wrap">
                      {dupTotal > 1 && (
                        <span className="copy-tag">{copyOf}/{dupTotal}</span>
                      )}
                      <Card
                        number={num}
                        variant={variant}
                        slot={room.slot}
                        slotIdx={slotIdx}
                        disabled={!isActive || demolishMode}
                      />
                    </div>
                  );
                })}
              </div>
              )}
              {showDetails && isActive && (
                <button
                  type="button"
                  className="skip-rest-btn"
                  onClick={() => {
                    room.furniture_numbers.forEach((_, slotIdx) => {
                      const k = instanceKey(room.slot, slotIdx);
                      if (!placedCardKeys.has(k) && !skippedCardKeys.has(k)) {
                        skipCard(room.slot, slotIdx);
                      }
                    });
                  }}
                >
                  Skip remaining cards
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
