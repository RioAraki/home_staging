import { useEffect, useState } from 'react';
import { cardByNumberVariant } from '../data';
import { useGameStore, instanceKey, type Variant } from '../store/game';
import type { RoomSlot } from '../types';
import { FurnitureShape } from './FurnitureShape';
import './Card.css';

interface CardProps {
  number: number;
  variant: Variant;
  slot: RoomSlot;
  slotIdx: number;
  disabled?: boolean;
}

export function Card({ number, variant, slot, slotIdx, disabled }: CardProps) {
  const key = instanceKey(slot, slotIdx);
  const revealed = useGameStore((s) => s.revealedCardKeys.has(key));
  const selectedOption = useGameStore((s) => s.selectedOption);
  const placed = useGameStore((s) => s.placedCardKeys.has(key));
  const skipped = useGameStore((s) => s.skippedCardKeys.has(key));
  const revealCard = useGameStore((s) => s.revealCard);
  const selectOption = useGameStore((s) => s.selectOption);
  const skipCard = useGameStore((s) => s.skipCard);
  const unskipCard = useGameStore((s) => s.unskipCard);
  const unplaceCard = useGameStore((s) => s.unplaceCard);
  const activeRoomSlot = useGameStore((s) => s.activeRoomSlot);
  const selectRoom = useGameStore((s) => s.selectRoom);

  // Auto-select this card's room if it isn't already active. Returns
  // true on success (room is now active), false if selectRoom refused
  // — e.g. another room is mid-build with placed pieces. In the refusal
  // case selectRoom surfaces a lastError so the user knows why nothing
  // happened.
  const ensureRoomActive = (): boolean => {
    if (activeRoomSlot === slot) return true;
    selectRoom(slot);
    return useGameStore.getState().activeRoomSlot === slot;
  };

  // Card auto-collapses to a one-line "placed" bar whenever it transitions
  // into the placed state. Click the bar to expand. Withdraw lives only in
  // the expanded view so single-click on the bar stays non-destructive.
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  useEffect(() => { setManuallyExpanded(false); }, [placed]);

  const card = cardByNumberVariant(number, variant);
  if (!card) return <div className="card error">no card {number}{variant}</div>;

  const resolved = placed || skipped;
  // "isMine" = this exact card instance owns the current selection
  const isMine =
    !!selectedOption && selectedOption.slot === slot && selectedOption.slotIdx === slotIdx;
  const chosenOptIdx = isMine ? selectedOption!.optionIndex : null;

  const handleReveal = () => {
    if (disabled || resolved) return;
    if (!ensureRoomActive()) return;
    if (!revealed) {
      revealCard(slot, slotIdx);
      if (card.options.length === 1) {
        selectOption({ slot, slotIdx, optionIndex: card.options[0].option_index });
      }
    }
  };

  if (!revealed && !resolved) {
    return (
      <button
        type="button"
        className={`card down ${disabled ? 'disabled' : ''}`}
        onClick={handleReveal}
        disabled={disabled}
        aria-label={`Furniture card ${number}, click to reveal`}
      >
        <span className="card-num">{number}</span>
        <span className="card-corner top-left">{number}</span>
        <span className="card-corner bottom-right">{number}</span>
      </button>
    );
  }

  if (placed && !manuallyExpanded) {
    return (
      <button
        type="button"
        className="card placed-bar"
        onClick={() => setManuallyExpanded(true)}
        aria-label={`Placed card ${number}, click to expand`}
        title="Click to expand"
      >
        <span className="num">#{number}</span>
        <span className="badge placed-badge">placed</span>
        <span className="chev">⌄</span>
      </button>
    );
  }

  return (
    <div className={`card up ${placed ? 'placed' : ''} ${skipped ? 'skipped' : ''} ${isMine ? 'selected' : ''}`}>
      <div className="card-header">
        <span className="num">#{number}</span>
        <span className="variant">{variant}</span>
        {placed && <span className="badge placed-badge">placed</span>}
        {skipped && <span className="badge skipped-badge">skipped</span>}
        {isMine && !resolved && <span className="badge selected-badge">selected</span>}
        {placed && manuallyExpanded && (
          <button
            type="button"
            className="card-collapse-btn"
            onClick={() => setManuallyExpanded(false)}
            title="Collapse this placed card"
            aria-label="Collapse placed card"
          >
            ⌃
          </button>
        )}
      </div>
      <div className="card-options">
        {card.options.map((opt) => {
          const isSelected = isMine && chosenOptIdx === opt.option_index;
          return (
            <button
              type="button"
              key={opt.option_index}
              className={`option-btn ${isSelected ? 'on' : ''}`}
              onClick={() => {
                if (resolved || disabled) return;
                if (!ensureRoomActive()) return;
                selectOption({ slot, slotIdx, optionIndex: opt.option_index });
              }}
              disabled={resolved || disabled}
              aria-label={`Option ${opt.option_index}: ${opt.name_zh}`}
            >
              <FurnitureShape option={opt} number={number} variant={variant} cellSize={14} />
              <span className="opt-name">{opt.name_zh}</span>
            </button>
          );
        })}
      </div>
      {!resolved && (
        <button
          type="button"
          className="skip-card-btn"
          onClick={() => {
            if (disabled) return;
            if (!ensureRoomActive()) return;
            skipCard(slot, slotIdx);
          }}
          disabled={disabled}
        >
          ⤿ Skip this card
        </button>
      )}
      {skipped && !placed && (
        <button
          type="button"
          className="unskip-card-btn"
          onClick={() => unskipCard(slot, slotIdx)}
          title="Bring this skipped card back so you can place it. Available even when this room isn't the active one — un-skip and withdraw are card-state edits, not placement, so they don't require the room to be active."
        >
          ↺ Un-skip
        </button>
      )}
      {placed && (
        <button
          type="button"
          className="unplace-card-btn"
          onClick={() => unplaceCard(slot, slotIdx)}
          title="Remove this piece from the floor plan and free the card for another placement. Available regardless of which room is active."
        >
          ↺ Withdraw piece
        </button>
      )}
    </div>
  );
}
