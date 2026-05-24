import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';
import path from 'node:path';

// Single source of truth: YAML data lives in ../md/, imported at build time.
export default defineConfig({
  plugins: [react(), yaml()],
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
