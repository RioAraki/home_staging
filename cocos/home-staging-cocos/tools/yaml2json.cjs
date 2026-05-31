// cocos/home-staging-cocos/tools/yaml2json.cjs
// Converts md/*.yaml -> cocos/home-staging-cocos/assets/resources/data/*.json
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..', '..');  // home_staging/
const SRC_DIR = path.join(ROOT, 'md');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'resources', 'data');

const files = [
  ['furniture_data.yaml', 'furniture_data.json'],
  ['maps_data.yaml',      'maps_data.json'],
];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [src, dst] of files) {
  const srcPath = path.join(SRC_DIR, src);
  const dstPath = path.join(OUT_DIR, dst);
  const raw = fs.readFileSync(srcPath, 'utf-8');
  const parsed = yaml.load(raw);
  fs.writeFileSync(dstPath, JSON.stringify(parsed));
  console.log(`OK ${src} -> ${dst}  (${(JSON.stringify(parsed).length / 1024).toFixed(1)} KB)`);
}
