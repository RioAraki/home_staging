import type { ThemeTokens } from '../types';

/** Default theme — white sketch lines on the existing navy game background. */
export const blueprint: ThemeTokens = {
  id: 'blueprint',
  label: 'Blueprint',
  bg: '#102a47',
  stroke: 'rgba(255,255,255,0.92)',
  fill: 'none',
  accent: '#ffe169',
  strokeWidth: 1.8,
  detailStroke: 'rgba(255,255,255,0.55)',
  detailStrokeWidth: 1.1,
};
