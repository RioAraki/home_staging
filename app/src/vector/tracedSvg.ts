// Lookup of per-cell auto-traced SVGs produced by md/trace_cards.py.
//
// One SVG per (number, variant, optionIndex, row, col) — the renderer
// stamps each shape cell with its corresponding cell-trace and skips
// cells that don't have one (void cells, or open cells the script
// didn't bother to trace). The naming convention is
// `NN_X_optK_cell_R_C.svg` under `app/public/cards/vectors/`.

const cellSvgUrls = import.meta.glob<string>(
  '/public/cards/vectors/*.svg',
  { eager: true, import: 'default', query: '?url' },
) as Record<string, string>;

const byFileName = new Map<string, string>();
for (const [absPath, url] of Object.entries(cellSvgUrls)) {
  const name = absPath.split('/').pop();
  if (name) byFileName.set(name, url);
}

function fileNameFor(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
  row: number,
  col: number,
): string {
  return `${String(number).padStart(2, '0')}_${variant}_opt${optionIndex}_cell_${row}_${col}.svg`;
}

export function cellTracedSvgUrl(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
  row: number,
  col: number,
): string | null {
  return byFileName.get(fileNameFor(number, variant, optionIndex, row, col)) ?? null;
}

export function hasAnyCellTrace(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
): boolean {
  const prefix = `${String(number).padStart(2, '0')}_${variant}_opt${optionIndex}_cell_`;
  for (const name of byFileName.keys()) {
    if (name.startsWith(prefix)) return true;
  }
  return false;
}
