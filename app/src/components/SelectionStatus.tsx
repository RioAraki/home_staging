import { cardByNumberVariant } from '../data';
import { useGameStore, isRoomReadyToSeal } from '../store/game';
import { FurnitureShape } from './FurnitureShape';
import { useMemo } from 'react';
import './SelectionStatus.css';

export function SelectionStatus() {
  const selected = useGameStore((s) => s.selectedOption);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const rotateSelection = useGameStore((s) => s.rotateSelection);
  const mirrorSelection = useGameStore((s) => s.mirrorSelection);
  const skipSelected = useGameStore((s) => s.skipSelected);
  const jokerUsed = useGameStore((s) => s.jokerUsed);
  const lastError = useGameStore((s) => s.lastError);
  // WallModeBanner already shows lastError when it's visible — avoid
  // duplicating the message in two places.
  const scenario = useGameStore((s) => s.scenario);
  const activeRoomSlot = useGameStore((s) => s.activeRoomSlot);
  const placedCardKeys = useGameStore((s) => s.placedCardKeys);
  const skippedCardKeys = useGameStore((s) => s.skippedCardKeys);
  const wallModeShowsError =
    !!scenario && !!activeRoomSlot &&
    isRoomReadyToSeal(scenario, { placedCardKeys, skippedCardKeys }, activeRoomSlot);
  const showLocalError = lastError && !wallModeShowsError;

  const rawOption = useMemo(() => {
    if (!selected) return null;
    const card = cardByNumberVariant(selected.number, selected.variant);
    return card?.options.find((o) => o.option_index === selected.optionIndex) ?? null;
  }, [selected]);

  if (!selected || !rawOption) {
    return (
      <div className="selection-status empty">
        <span className="hint">
          No piece selected. Flip a card to begin.
          {' '}
          {jokerUsed ? (
            <span className="joker-spent">💡 Joker used</span>
          ) : (
            <span className="joker-avail">💡 Joker available</span>
          )}
        </span>
      </div>
    );
  }

  const isMirrored = selected.mirrored;
  const jokerDisabled = jokerUsed && !isMirrored;

  return (
    <div className={`selection-status ${isMirrored ? 'mirroring' : ''}`}>
      <div className="sel-label">Selected:</div>
      <div className="sel-piece">
        <FurnitureShape
          option={rawOption}
          number={selected.number}
          variant={selected.variant}
          rotation={selected.rotation}
          mirrored={selected.mirrored}
          cellSize={22}
        />
        <div className="sel-meta">
          <strong>#{selected.number}{selected.variant}</strong>
          <span>· {rawOption.name_zh}</span>
          {isMirrored && <span className="mirror-tag">💡 mirrored (joker tentatively used)</span>}
          <span className="sel-hint">
            Click a grid cell to place · Press <kbd>R</kbd> to rotate
          </span>
        </div>
      </div>
      <div className="sel-actions">
        <button type="button" className="sel-rotate" onClick={rotateSelection} title="Rotate (R)">
          ↻ Rotate
        </button>
        <button
          type="button"
          className={`sel-joker ${isMirrored ? 'on' : ''} ${jokerDisabled ? 'spent' : ''}`}
          onClick={mirrorSelection}
          disabled={jokerDisabled}
          title={
            jokerDisabled
              ? 'Joker already used'
              : isMirrored
              ? 'Cancel mirror'
              : 'Mirror this piece (uses Joker)'
          }
        >
          {jokerDisabled ? '💡✕' : isMirrored ? '💡 Cancel mirror' : '💡 Mirror'}
        </button>
        <button type="button" className="sel-skip" onClick={skipSelected} title="Skip this card">
          ⤿ Skip card
        </button>
        <button type="button" className="sel-clear" onClick={clearSelection}>
          Cancel
        </button>
      </div>
      {showLocalError && <div className="sel-error">{lastError}</div>}
    </div>
  );
}
