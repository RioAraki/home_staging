import { blueprint } from './blueprint';
import { flat } from './flat';
import type { ThemeTokens } from '../types';

export const themes: Record<string, ThemeTokens> = {
  blueprint,
  flat,
};

export type ThemeId = keyof typeof themes;

export const DEFAULT_THEME_ID: ThemeId = 'blueprint';
