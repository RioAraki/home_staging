import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// tests/ → home-staging-cocos/ → cocos/ → home_staging/
const testDir = dirname(fileURLToPath(import.meta.url));
const SCEN_DIR = resolve(testDir, '../../../md/scenarios');
const BUNDLE_JSON = resolve(testDir, '../assets/resources/data/maps_data.json');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf-8'));

describe('scenario per-level sources ↔ bundled maps_data.json', () => {
  const index: string[] = readJson(resolve(SCEN_DIR, '_index.json'));
  const bundle = readJson(BUNDLE_JSON);

  it('_index.json lists every per-level file exactly once', () => {
    const onDisk = readdirSync(SCEN_DIR)
      .filter((f) => f.endsWith('.json') && f !== '_index.json')
      .map((f) => f.slice(0, -5))
      .sort();
    expect([...index].sort()).toEqual(onDisk);
    expect(new Set(index).size).toBe(index.length); // no dups
  });

  it('reassembling per-level files in _index order deep-equals the shipped bundle', () => {
    const reassembled = { scenarios: index.map((id) => readJson(resolve(SCEN_DIR, `${id}.json`))) };
    // This is the exact data both the cocos game and the bundle pipeline use.
    expect(reassembled).toEqual(bundle);
  });

  it('bundle scenario order matches _index order', () => {
    expect(bundle.scenarios.map((s: { id: string }) => s.id)).toEqual(index);
  });
});
