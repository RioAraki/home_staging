import { useMemo, useState, useEffect } from 'react';
import type { Scenario } from '../types';
import { useGameStore } from '../store/game';
import { computeScore } from '../lib/scoring';
import './EndGameScreen.css';

interface Props { scenario: Scenario }

export function EndGameScreen({ scenario }: Props) {
  const completedRoomSlots = useGameStore((s) => s.completedRoomSlots);
  const placedPieces = useGameStore((s) => s.placedPieces);
  const walls = useGameStore((s) => s.walls);
  const doors = useGameStore((s) => s.doors);
  const initRun = useGameStore((s) => s.initRun);

  const finished = scenario.rooms.every((r) => completedRoomSlots.has(r.slot));
  const score = useMemo(
    () => (finished ? computeScore(scenario, placedPieces, walls, doors) : null),
    [finished, scenario, placedPieces, walls, doors],
  );

  // Auto-open the score panel when the game first finishes. The user can
  // dismiss it to inspect the floor plan and re-open via the floating chip.
  const [showScore, setShowScore] = useState(false);
  useEffect(() => {
    if (finished) setShowScore(true);
  }, [finished]);

  if (!finished || !score) return null;

  if (!showScore) {
    return (
      <button
        type="button"
        className="endgame-chip"
        onClick={() => setShowScore(true)}
        title="Show score details"
      >
        Final score: <strong>{score.total}</strong> · 📋 Show details
      </button>
    );
  }

  return (
    <div className="endgame-overlay">
      <div className="endgame-card">
        <div className="endgame-card-header">
          <div>
            <h2>Game complete</h2>
            <p className="endgame-sub">
              {scenario.title_zh} · {scenario.title_en}
            </p>
          </div>
          <button
            type="button"
            className="endgame-dismiss"
            onClick={() => setShowScore(false)}
            title="View your floor plan"
          >
            👁 View floor plan
          </button>
        </div>

        <div className="endgame-section">
          <h3>Rooms</h3>
          <table className="endgame-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Pieces</th>
                <th>Squares</th>
                <th>Access</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {score.rooms.map((r) => {
                const subtotal = r.empty ? -3 : r.countedSquares;
                const ignoredCount = r.pieceCount - r.validPieceCount;
                return (
                  <tr
                    key={r.slot}
                    className={`${r.empty ? 'empty-room' : ''} ${!r.accessible && !r.empty ? 'inaccessible-room' : ''}`}
                  >
                    <td>
                      {r.slot} · {r.name_zh}
                      {r.empty && <span className="penalty-tag"> (empty −3)</span>}
                      {ignoredCount > 0 && !r.empty && (
                        <span className="penalty-tag"> ({ignoredCount} ignored)</span>
                      )}
                    </td>
                    <td>{r.pieceCount}</td>
                    <td>
                      {r.countedSquares}
                      {r.occupiedSquares !== r.countedSquares && (
                        <span className="dropped"> / {r.occupiedSquares}</span>
                      )}
                    </td>
                    <td>{r.empty ? '—' : r.accessible ? '✓' : '✗'}</td>
                    <td>{subtotal}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Squares + penalties</td>
                <td>{score.totalSquares + score.emptyRoomPenalty}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="endgame-section">
          <h3>Bonus points</h3>
          <ul className="bonus-list">
            {score.bonuses.map((b, i) => (
              <li key={i} className={b.earned ? 'earned' : 'missed'}>
                <span className="bonus-marker">{b.earned ? '✓' : '·'}</span>
                <span className="bonus-text">{b.text_zh}</span>
                <span className="bonus-points">{b.earned ? `+${b.points}` : '+0'}</span>
              </li>
            ))}
          </ul>
          <div className="bonus-total">Bonus subtotal: <strong>+{score.bonusTotal}</strong></div>
        </div>

        <div className="endgame-total">
          <span>Final score</span>
          <span className="big-total">{score.total}</span>
        </div>

        {(score.doorIssues.length > 0 || score.pieceIssues.length > 0 || score.notes.length > 0) && (
          <div className="endgame-notes">
            {score.doorIssues.map((n, i) => (
              <div key={`d${i}`} className="note bad">✗ {n}</div>
            ))}
            {score.pieceIssues.map((n, i) => (
              <div key={`p${i}`} className="note bad">✗ {n}</div>
            ))}
            {score.notes.map((n, i) => (
              <div key={`n${i}`} className="note">⚠ {n}</div>
            ))}
          </div>
        )}

        <div className="endgame-actions">
          <button
            type="button"
            className="dismiss-btn"
            onClick={() => setShowScore(false)}
          >
            👁 Hide & view floor plan
          </button>
          <button
            type="button"
            className="play-again-btn"
            onClick={() => initRun(scenario)}
          >
            ↻ Play again (re-roll variants)
          </button>
        </div>
      </div>
    </div>
  );
}
