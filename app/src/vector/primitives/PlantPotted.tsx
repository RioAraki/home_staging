import type { PrimitiveProps } from '../types';

/**
 * Potted plant — a trapezoidal pot at the bottom of each cell with 3–5
 * curved leaves arcing outward. Cleaner than the radial spider-burst
 * older primitive; reads as "a plant" at any cell size and stays
 * inside its own cell so adjacent plants don't bleed into one another.
 *
 * extras:
 *   leaves (number, default 4) — number of curved leaves per pot.
 *   accentPot (boolean, default true) — fill the pot with accent
 *     colour to make it pop against the dark backdrop.
 */
export function PlantPotted({ cells, cellSize, theme, extras }: PrimitiveProps) {
  const leafCount = Math.max(3, Math.min(7, Number(extras.leaves) || 4));
  const accentPot = extras.accentPot !== false;
  const potTopRatio = 0.32;        // pot top width as fraction of cellSize
  const potBotRatio = 0.22;
  const potHRatio = 0.20;
  const leafLen = cellSize * 0.32;

  return (
    <g className="primitive plant-potted">
      {cells.map(([r, c], i) => {
        const cx = c * cellSize + cellSize / 2;
        const cellTop = r * cellSize;
        const cellBot = (r + 1) * cellSize;
        // Pot sits at the lower 30% of the cell.
        const potTopY = cellBot - cellSize * 0.30;
        const potBotY = potTopY + cellSize * potHRatio;
        const potTopW = cellSize * potTopRatio;
        const potBotW = cellSize * potBotRatio;
        const potPath =
          `M ${cx - potTopW / 2} ${potTopY} ` +
          `L ${cx + potTopW / 2} ${potTopY} ` +
          `L ${cx + potBotW / 2} ${potBotY} ` +
          `L ${cx - potBotW / 2} ${potBotY} Z`;
        // Each leaf = a curved tear-drop from pot top arcing outward + up.
        const leafTipBaseY = potTopY - cellSize * 0.06;
        const leaves = Array.from({ length: leafCount }, (_, k) => {
          const t = leafCount === 1 ? 0 : k / (leafCount - 1);   // 0..1
          // Spread leaves across an angle range; convert to a tip target
          // above the pot.
          const angle = (t - 0.5) * 150 * (Math.PI / 180);   // -75°..+75°
          const tipX = cx + Math.sin(angle) * leafLen;
          const tipY = leafTipBaseY - Math.cos(angle) * leafLen;
          // Anchor at the pot's top centre with a slight horizontal offset
          // matching the leaf direction so it looks like it grows from
          // that side.
          const anchorX = cx + Math.sin(angle) * (potTopW / 4);
          const anchorY = potTopY;
          // Curve control = roughly the midpoint biased outward.
          const midX = (anchorX + tipX) / 2 + Math.sin(angle) * cellSize * 0.06;
          const midY = (anchorY + tipY) / 2 - cellSize * 0.04;
          const d = `M ${anchorX} ${anchorY} Q ${midX} ${midY} ${tipX} ${tipY}`;
          return (
            <path
              key={k}
              d={d}
              stroke={theme.stroke}
              strokeWidth={theme.strokeWidth * 0.9}
              strokeLinecap="round"
              fill="none"
            />
          );
        });
        // Soft dot at the bottom of the cell to imply the floor / ground.
        // (Subtle, only if a fill is enabled — skipped for stroke-only themes.)
        const groundDot = theme.fill !== 'none' ? (
          <circle cx={cx} cy={cellBot - cellSize * 0.06} r={cellSize * 0.03} fill={theme.accent} />
        ) : null;
        // Silence unused warning for cellTop — kept named for clarity.
        void cellTop;
        return (
          <g key={i}>
            {leaves}
            <path
              d={potPath}
              fill={accentPot ? theme.accent : (theme.fill === 'none' ? 'rgba(255,255,255,0.10)' : theme.fill)}
              stroke={theme.stroke}
              strokeWidth={theme.strokeWidth * 0.9}
              strokeLinejoin="round"
            />
            {groundDot}
          </g>
        );
      })}
    </g>
  );
}
