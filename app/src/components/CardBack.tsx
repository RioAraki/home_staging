import './CardBack.css';

interface CardBackProps {
  number: number;
  faceDown?: boolean;   // currently always true; later flipping uses this
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * The face-down look of a furniture card — minimal blueprint sketch with
 * the card's furniture number written on the back, like a real game card.
 */
export function CardBack({ number, faceDown = true, onClick, disabled }: CardBackProps) {
  return (
    <button
      type="button"
      className={`card-back ${faceDown ? 'down' : 'up'} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`Furniture card ${number}`}
    >
      <span className="card-num">{number}</span>
      <span className="card-corner top-left">{number}</span>
      <span className="card-corner bottom-right">{number}</span>
    </button>
  );
}
