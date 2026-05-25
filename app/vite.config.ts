import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';
import path from 'node:path';
import { reviewSyncPlugin } from './vite-plugins/review-sync';
import { gameSaveSyncPlugin } from './vite-plugins/game-save-sync';

// Single source of truth: YAML data lives in ../md/, imported at build time.
export default defineConfig({
  plugins: [
    react(),
    yaml(),
    reviewSyncPlugin({
      filePath: path.resolve(__dirname, '../md/review_comments.json'),
    }),
    gameSaveSyncPlugin({
      savesDir: path.resolve(__dirname, '../md/saves'),
    }),
  ],
  server: {
    fs: {
      // Allow Vite to read YAML files from the sibling md/ directory.
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '@data': path.resolve(__dirname, '../md'),
    },
  },
});
