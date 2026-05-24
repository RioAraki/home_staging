import type { Room } from '../types';
import { useGameStore } from '../store/game';
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
  const skipCard = useGameStore((s) => s.skipCard);
  const selectRoom = useGameStore((s) => s.selectRoom);
  const autoRevealRoomCards = useGameStore((s) => s.autoRevealRoomCards);

  const otherRoomActive = (slot: string) =>
    activeRoomSlot !== null &&
    activeRoomSlot !== slot &&
    !completedRoomSlots.has(activeRoomSlot);

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
          return (
            <li
              key={room.slot}
              className={`room-item ${isActive ? 'active' : ''} ${
                isLocked ? 'locked' : ''
              } ${isCompleted ? 'completed' : ''}`}
            >
              <button
                type="button"
                className="room-header"
                onClick={() => {
                  selectRoom(room.slot);
                  autoRevealRoomCards(room.furniture_numbers);
                }}
                disabled={isLocked && !isActive}
              >
                <span className="room-slot">{room.slot}</span>
                <span className="room-name">
                  {room.name_zh} <span className="room-name-en">({room.name_en})</span>
                </span>
                <span className="room-state">{stateLabel}</span>
              </button>
              <div className="room-cards">
                {room.furniture_numbers.map((num) => {
                  const variant = chosenVariants[num] ?? 'A';
                  return (
                    <Card
                      key={`${num}-${variant}`}
                      number={num}
                      variant={variant}
                      disabled={!isActive}
                    />
                  );
                })}
              </div>
              {isActive && (
                <button
                  type="button"
                  className="skip-rest-btn"
                  onClick={() => {
                    for (const num of room.furniture_numbers) {
                      const v = chosenVariants[num] ?? 'A';
                      const k = `${num}-${v}`;
                      if (!placedCardKeys.has(k) && !skippedCardKeys.has(k)) {
                        skipCard(num, v);
                      }
                    }
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
