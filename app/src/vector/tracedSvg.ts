// Lookup of auto-traced SVGs produced by md/trace_cards.py.
//
// The script writes one .svg per option crop into app/public/cards/vectors/.
// We eagerly import their URLs at build time via Vite glob so the renderer
// can ask "is there a traced SVG for (number, variant, optionIndex)?" in
// O(1) without a fetch.
//
// Naming convention matches optionImageUrl: `NN_X_optK.svg`.

const tracedSvgUrls = import.meta.glob<string>(
  '/public/cards/vectors/*.svg',
  { eager: true, import: 'default', query: '?url' },
) as Record<string, string>;

// Build a name → url map (the keys above are absolute paths starting with
// "/public/...", we strip down to just the filename so callers can ask
// by "01_A_opt1.svg").
const byFileName = new Map<string, string>();
for (const [absPath, url] of Object.entries(tracedSvgUrls)) {
  const name = absPath.split('/').pop();
  if (name) byFileName.set(name, url);
}

export function tracedSvgUrl(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
): string | null {
  const filename = `${String(number).padStart(2, '0')}_${variant}_opt${optionIndex}.svg`;
  return byFileName.get(filename) ?? null;
}

export function hasTracedSvg(
  number: number,
  variant: 'A' | 'B',
  optionIndex: number,
): boolean {
  return tracedSvgUrl(number, variant, optionIndex) !== null;
}
