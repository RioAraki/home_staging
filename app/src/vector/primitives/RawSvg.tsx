import type { PrimitiveProps } from '../types';

/**
 * Manual hand-authored SVG primitive. Paste any SVG markup
 * (`<rect>`, `<path>`, `<g>`, `<line>`, ...) into the schema's `paths`
 * field and we drop it verbatim inside the option's group, scaled and
 * translated so the user can draw using a consistent **100 units per
 * cell** coordinate system.
 *
 * Workflow (see md/VECTORIZE_FURNITURE.md):
 *   1. Open your SVG editor (Inkscape, Figma, Illustrator, Boxy SVG).
 *   2. Set the canvas to `cols * 100 × rows * 100` user units.
 *   3. Draw the furniture top-down at that scale.
 *   4. Export and copy the inner markup (between `<svg>` and `</svg>`).
 *   5. Paste into the option's `parts:` entry as `kind: raw_svg`,
 *      listing the cells it covers.
 *
 * extras:
 *   paths (string) — raw SVG markup to inject. Anything that's valid
 *     inside an `<svg>` element is fine.
 *   unitsPerCell (number, default 100) — override the assumed unit
 *     scale per cell if you prefer a different convention.
 */
export function RawSvg({ cells, cellSize, extras }: PrimitiveProps) {
  const paths = (extras.paths as string | undefined) ?? '';
  if (!paths) return null;
  const unitsPerCell = Number(extras.unitsPerCell) > 0 ? Number(extras.unitsPerCell) : 100;
  if (cells.length === 0) return null;
  const rs = cells.map((c) => c[0]);
  const cs = cells.map((c) => c[1]);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  const x = c0 * cellSize;
  const y = r0 * cellSize;
  const scale = cellSize / unitsPerCell;
  return (
    <g
      className="primitive raw-svg"
      transform={`translate(${x}, ${y}) scale(${scale})`}
      // React allows dangerouslySetInnerHTML on SVG groups; the parser
      // treats the markup as SVG because it's inside an <svg> ancestor.
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}
