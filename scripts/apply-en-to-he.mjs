/**
 * Applies English→Hebrew string map to locales/he.json and locales/he-IL.json
 * Run after: node scripts/merge-hebrew-locales.mjs
 * Run: node scripts/apply-en-to-he.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '..', 'locales');

function stripComments(json) {
  return json.replace(/\/\*[\s\S]*?\*\//g, '').trim();
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function walkReplace(obj, map) {
  if (!isPlainObject(obj)) return obj;
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string') {
      if (Object.prototype.hasOwnProperty.call(map, v)) {
        out[k] = map[v];
      }
    } else if (isPlainObject(v)) {
      out[k] = walkReplace(v, map);
    }
  }
  return out;
}

const mapPath = path.join(__dirname, 'en-to-he-map.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

for (const name of ['he.json', 'he-IL.json']) {
  const p = path.join(localesDir, name);
  const raw = stripComments(fs.readFileSync(p, 'utf8'));
  const data = JSON.parse(raw);
  const merged = walkReplace(data, map);
  const header = `/*
 * ------------------------------------------------------------
 * Hebrew locale — merged + en-to-he-map applied (scripts/apply-en-to-he.mjs)
 * ------------------------------------------------------------
 */
`;
  fs.writeFileSync(p, header + JSON.stringify(merged, null, 2) + '\n', 'utf8');
}

console.log('Applied', Object.keys(map).length, 'string translations to he.json and he-IL.json');
