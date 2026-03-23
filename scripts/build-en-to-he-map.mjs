/**
 * Builds scripts/en-to-he-map.json from untranslated-strings.txt + he-parallel-data.mjs
 * Run: node scripts/build-en-to-he-map.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HE_LINES } from './he-parallel-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enPath = path.join(__dirname, 'untranslated-strings.txt');
const outPath = path.join(__dirname, 'en-to-he-map.json');

const en = fs
  .readFileSync(enPath, 'utf8')
  .split(/\n---\n/)
  .map((s) => s.trim())
  .filter(Boolean);

if (en.length !== HE_LINES.length) {
  console.error('Mismatch: English keys', en.length, 'Hebrew lines', HE_LINES.length);
  process.exit(1);
}

const map = {};
for (let i = 0; i < en.length; i++) {
  map[en[i]] = HE_LINES[i];
}

fs.writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log('Wrote', outPath, Object.keys(map).length, 'entries');
