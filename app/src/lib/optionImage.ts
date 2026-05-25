// URL helper for per-option furniture images served from public/cards/options/.
// The Python script split_option_images.py wrote files named NN_X_optK.jpg.

import type { Variant } from '../store/game';

export function optionImageUrl(
  number: number,
  variant: Variant,
  optionIndex: number,
): string {
  const num2 = String(number).padStart(2, '0');
  return `/cards/options/${num2}_${variant}_opt${optionIndex}.jpg`;
}
