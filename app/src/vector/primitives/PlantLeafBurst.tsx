import type { PrimitiveProps } from '../types';

/**
 * Spider-plant style burst — N tear-drop leaves radiating from a central pot.
 * Extras:
 *   density (number, default 7): number of radiating leaves
 */
export function PlantLeafBurst({ cells, cellSize, theme, extras }: PrimitiveProps) {
  const density = Math.max(3, Math.min(14, Number(extras.density) || 7));
  const leafLen = cellSize * 0.42;
  const leafWidth = cellSize * 0.13;
  const potR = cellSize * 0.11;
  // Stroke vs fill rendering — blueprint uses stroke-only, flat uses fill.
  const isStrokeOnly = theme.fill === 'none';
  const leafFill = isStrokeOnly ? 'none' : theme.fill;
  const leafStroke = isStrokeOnly ? theme.stroke : theme.detailStroke;
  const leafStrokeW = isStrokeOnly ? theme.strokeWidth : theme.detailStrokeWidth * 0.7;
  const potFill = isStrokeOnly ? theme.stroke : theme.accent;
  const potStroke = isStrokeOnly ? theme.stroke : theme.detailStroke;

  return (
    <g className="primitive plant-leaf-burst">
      {cells.map(([r, c], i) => {
        const cx = c * cellSize + cellSize / 2;
        const cy = r * cellSize + cellSize / 2;
        // Build N tear-drop leaves at evenly spaced angles.
        const leaves = Array.from({ length: density }, (_, k) => {
          const angle = (k * (360 / density) - 90) * (Math.PI / 180); // start at top
          const tipX = cx + leafLen * Math.cos(angle);
          const tipY = cy + leafLen * Math.sin(angle);
          // Two side points to form a tear-drop (small offset perpendicular to the angle).
          const px = -Math.sin(angle) * leafWidth;
          const py = Math.cos(angle) * leafWidth;
          // Anchor near the centre (so leaves come out of pot).
          const ax = cx + Math.cos(angle) * potR;
          const ay = cy + Math.sin(angle) * potR;
          const d = `M ${ax + px} ${ay + py} Q ${cx + Math.cos(angle) * leafLen * 0.5} ${cy + Math.sin(angle) * leafLen * 0.5} ${tipX} ${tipY} Q ${cx + Math.cos(angle) * leafLen * 0.5} ${cy + Math.sin(angle) * leafLen * 0.5} ${ax - px} ${ay - py} Z`;
          return (
            <path
              key={k}
              d={d}
              fill={leafFill}
              stroke={leafStroke}
              strokeWidth={leafStrokeW}
              strokeLinejoin="round"
            />
          );
        });
        return (
          <g key={i}>
            {leaves}
            <circle cx={cx} cy={cy} r={potR} fill={potFill} stroke={potStroke} strokeWidth={leafStrokeW} />
          </g>
        );
      })}
    </g>
  );
}
