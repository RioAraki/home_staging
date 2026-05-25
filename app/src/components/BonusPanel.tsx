// Always-visible bonus-goals panel. Each scenario lists optional point
// objectives; this panel shows them with a live earned/unearned indicator
// that updates as the player places (or skips) furniture.

import { useMemo } from 'react';
import type { Scenario } from '../types';
import { useGameStore } from '../store/game';
import { evaluateBonusCondition } from '../lib/scoring';
import './BonusPanel.css';

interface Props {
  scenario: Scenario;
}

export function BonusPanel({ scenario }: Props) {
  const placedPieces = useGameStore((s) => s.placedPieces);
  const walls = useGameStore((s) => s.walls);
  const doors = useGameStore((s) => s.doors);
  const windows = useGameStore((s) => s.windows);

  const evaluated = useMemo(
    () => scenario.bonus_points.map((bp) => ({
      bp,
      ...evaluateBonusCondition(bp, scenario, placedPieces, { walls, doors, windows }),
    })),
    [scenario, placedPieces, walls, doors, windows],
  );

  if (evaluated.length === 0) {
    return (
      <aside className="bonus-panel empty">
        <div className="bonus-title">Bonus goals</div>
        <div className="bonus-empty-hint">— none for this scenario —</div>
      </aside>
    );
  }

  // Per-match bonuses (count defined) scale points by match count. The
  // YAML's bp.points is the per-match value; total earned is points × count.
  const pointsEarned = (e: typeof evaluated[number]): number => {
    if (e.count !== undefined) return e.bp.points * e.count;
    return e.earned ? e.bp.points : 0;
  };
  const earnedTotal = evaluated.reduce((sum, e) => sum + pointsEarned(e), 0);
  const maxTotal = evaluated.reduce((sum, e) => sum + e.bp.points, 0);

  // Gather every special-rule reminder (anything non-default in scenario.rules).
  const specialRules: Array<{ id: string; text: string }> = [];
  const r = scenario.rules ?? {};
  if (r.hallway && r.hallway.required === false) {
    specialRules.push({
      id: 'no-hallway',
      text: r.hallway.notes_zh || '无走廊',
    });
  }
  if (r.front_door) {
    const fd = r.front_door;
    if (fd.forced_cells && fd.forced_cells.length === 1) {
      const [fr, fc] = fd.forced_cells[0];
      const colLetter = String.fromCharCode(65 + fc);
      specialRules.push({
        id: 'front-door-fixed',
        text: `大门固定在 ${fr + 1}${colLetter}（已自动设置）`,
      });
    } else if (fd.forced_cells && fd.forced_cells.length > 1) {
      const positions = fd.forced_cells
        .map(([fr, fc]) => `${fr + 1}${String.fromCharCode(65 + fc)}`)
        .join(' / ');
      specialRules.push({
        id: 'front-door-choice',
        text: `大门只能设在：${positions}`,
      });
    } else if (fd.on_exterior_wall_anywhere === false) {
      specialRules.push({
        id: 'front-door-restricted',
        text: '大门位置受限（详见原版规则书）',
      });
    }
  }
  for (const d of r.drawing ?? []) {
    specialRules.push({ id: d.id, text: d.text_zh });
  }

  return (
    <aside className="bonus-panel">
      <div className="bonus-title">
        🎯 Bonus goals
        <span className="bonus-running">
          {earnedTotal}<span className="bonus-running-max"> / +{maxTotal}</span>
        </span>
      </div>
      <ul className="bonus-list">
        {evaluated.map((e, i) => (
          <li
            key={i}
            className={`bonus-item ${e.earned ? 'earned' : 'pending'}`}
            title={e.note}
          >
            <span className="bonus-marker">{e.earned ? '✓' : '○'}</span>
            <span className="bonus-text">
              {e.bp.text_zh}
              {e.note && (
                <span className="bonus-note">— {e.note}</span>
              )}
            </span>
            <span className="bonus-pts">
              {e.count !== undefined && e.count > 0
                ? `+${e.bp.points * e.count} (${e.bp.points}×${e.count})`
                : `+${e.bp.points}`}
            </span>
          </li>
        ))}
      </ul>
      {specialRules.length > 0 && (
        <div className="drawing-rules" title="Scenario-specific special rules — most are not auto-validated, follow them manually">
          <span className="drawing-rules-label">📋 special rules:</span>
          {specialRules.map((rule) => (
            <span key={rule.id} className="drawing-rule-chip">{rule.text}</span>
          ))}
        </div>
      )}
    </aside>
  );
}
