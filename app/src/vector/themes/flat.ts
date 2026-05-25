import type { ThemeTokens } from '../types';

/** Modern flat-color theme — solid fills with subtle outlines. */
export const flat: ThemeTokens = {
  id: 'flat',
  label: 'Flat color',
  bg: '#102a47',         // game bg stays the same; primitives stand out via fill
  stroke: '#1a2c3f',     // dark outline used when needed
  fill: '#9fc4e3',       // light blue body
  accent: '#ffb84d',     // warm accent
  strokeWidth: 0,        // most primitives render fills only
  detailStroke: '#3a5a7f',
  detailStrokeWidth: 1.4,
};
