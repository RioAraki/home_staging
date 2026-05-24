import { cardByNumberVariant } from '../data';
import { useGameStore } from '../store/game';
import { FurnitureShape } from './FurnitureShape';
import { transformOption } from '../lib/geometry';
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

  // Build a virtual "rotated/mirrored" option for preview
  const rotatedOption = useMemo(() => {
    if (!selected) return null;
    const card = cardByNumberVariant(selected.number, selected.variant);
    const opt = card?.options.find((o) => o.option_index === selected.optionIndex);
    if (!opt) return null;
    const t = transformOption(opt, selected.rotation, selected.mirrored);
    // Return a pseudo-FurnitureOption with transformed cells so FurnitureShape can render it
    return {
      option_index: opt.option_index,
      name_zh: opt.name_zh,
      name_en: opt.name_en,
      bbox: t.bbox,
      shape: t.shape,
      open_spaces: t.open_spaces,
      wall_edges: t.wall_edges,
      printed_markers: opt.printed_markers,
    };
  }, [selected]);

  if (!selected || !rotatedOption) {
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
        <FurnitureShape option={rotatedOption} cellSize={22} />
        <div className="sel-meta">
          <strong>#{selected.number}{selected.variant}</strong>
          <span>· {rotatedOption.name_zh}</span>
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
      {lastError && <div className="sel-error">{lastError}</div>}
    </div>
  );
}
