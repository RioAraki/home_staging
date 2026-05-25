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

  const card = cardByNumberVariant(number, variant);
  if (!card) return <div className="card error">no card {number}{variant}</div>;

  const resolved = placed || skipped;
  // "isMine" = this exact card instance owns the current selection
  const isMine =
    !!selectedOption && selectedOption.slot === slot && selectedOption.slotIdx === slotIdx;
  const chosenOptIdx = isMine ? selectedOption!.optionIndex : null;

  const handleReveal = () => {
    if (disabled || resolved) return;
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

  return (
    <div className={`card up ${placed ? 'placed' : ''} ${skipped ? 'skipped' : ''} ${isMine ? 'selected' : ''}`}>
      <div className="card-header">
        <span className="num">#{number}</span>
        <span className="variant">{variant}</span>
        {placed && <span className="badge placed-badge">placed</span>}
        {skipped && <span className="badge skipped-badge">skipped</span>}
        {isMine && !resolved && <span className="badge selected-badge">selected</span>}
      </div>
      <div className="card-options">
        {card.options.map((opt) => {
          const isSelected = isMine && chosenOptIdx === opt.option_index;
          return (
            <button
              type="button"
              key={opt.option_index}
              className={`option-btn ${isSelected ? 'on' : ''}`}
              onClick={() =>
                !resolved && !disabled && selectOption({ slot, slotIdx, optionIndex: opt.option_index })
              }
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
          onClick={() => skipCard(slot, slotIdx)}
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
          disabled={disabled}
          title="Bring this skipped card back so you can place it"
        >
          ↺ Un-skip
        </button>
      )}
      {placed && (
        <button
          type="button"
          className="unplace-card-btn"
          onClick={() => unplaceCard(slot, slotIdx)}
          disabled={disabled}
          title="Remove this piece from the floor plan and free the card for another placement"
        >
          ↺ Withdraw piece
        </button>
      )}
    </div>
  );
}
