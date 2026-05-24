import { cardByNumberVariant } from '../data';
import { useGameStore, cardKey, type Variant } from '../store/game';
import { FurnitureShape } from './FurnitureShape';
import './Card.css';

interface CardProps {
  number: number;
  variant: Variant;
  disabled?: boolean;
}

export function Card({ number, variant, disabled }: CardProps) {
  const key = cardKey(number, variant);
  const revealed = useGameStore((s) => s.revealedCardKeys.has(key));
  const selectedOption = useGameStore((s) => s.selectedOption);
  const placed = useGameStore((s) => s.placedCardKeys.has(key));
  const skipped = useGameStore((s) => s.skippedCardKeys.has(key));
  const revealCard = useGameStore((s) => s.revealCard);
  const selectOption = useGameStore((s) => s.selectOption);
  const skipCard = useGameStore((s) => s.skipCard);

  const card = cardByNumberVariant(number, variant);
  if (!card) return <div className="card error">no card {key}</div>;

  const resolved = placed || skipped;
  const isMine = selectedOption?.number === number && selectedOption.variant === variant;
  const chosenOptIdx = isMine ? selectedOption.optionIndex : null;

  const handleReveal = () => {
    if (disabled || resolved) return;
    if (!revealed) {
      revealCard(number, variant);
      if (card.options.length === 1) {
        selectOption({ number, variant, optionIndex: card.options[0].option_index });
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
                !resolved && selectOption({ number, variant, optionIndex: opt.option_index })
              }
              disabled={resolved}
              aria-label={`Option ${opt.option_index}: ${opt.name_zh}`}
            >
              <FurnitureShape option={opt} cellSize={14} />
              <span className="opt-name">{opt.name_zh}</span>
            </button>
          );
        })}
      </div>
      {!resolved && (
        <button
          type="button"
          className="skip-card-btn"
          onClick={() => skipCard(number, variant)}
          disabled={disabled}
        >
          ⤿ Skip this card
        </button>
      )}
    </div>
  );
}
