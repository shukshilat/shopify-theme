/**
 * Merges en.default.json (complete keys) with he.json + he-IL.json (existing Hebrew).
 * Priority: he.json overrides he-IL.json overrides en.default.json
 * Run: node scripts/merge-hebrew-locales.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const localesDir = path.join(__dirname, '..', 'locales');

function stripComments(json) {
  return json.replace(/\/\*[\s\S]*?\*\//g, '').trim();
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Deep merge: `over` wins on conflicts */
function deepMerge(base, over) {
  if (over === undefined || over === null) return structuredClone(base);
  if (Array.isArray(over)) return over.slice();
  if (!isPlainObject(over)) return over;
  if (!isPlainObject(base)) return { ...over };

  const out = { ...base };
  for (const k of Object.keys(over)) {
    if (isPlainObject(over[k]) && isPlainObject(base[k])) {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

const enRaw = stripComments(fs.readFileSync(path.join(localesDir, 'en.default.json'), 'utf8'));
const heRaw = stripComments(fs.readFileSync(path.join(localesDir, 'he.json'), 'utf8'));
const heILRaw = stripComments(fs.readFileSync(path.join(localesDir, 'he-IL.json'), 'utf8'));

const en = JSON.parse(enRaw);
const he = JSON.parse(heRaw);
const heIL = JSON.parse(heILRaw);

// en <- he-IL <- he (most specific Hebrew wins)
let merged = deepMerge(en, heIL);
merged = deepMerge(merged, he);

const header = `/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * Merged from en.default.json + he-IL.json + he.json (scripts/merge-hebrew-locales.mjs)
 * Edit translations here or re-run merge after updating en.default.json
 * ------------------------------------------------------------
 */
`;

const body = JSON.stringify(merged, null, 2);
fs.writeFileSync(path.join(localesDir, 'he.json'), header + body + '\n', 'utf8');
fs.writeFileSync(path.join(localesDir, 'he-IL.json'), header + body + '\n', 'utf8');

function countLeaves(obj, prefix = '') {
  let n = 0;
  let enLike = 0;
  function walk(o, p) {
    if (!isPlainObject(o)) return;
    for (const k of Object.keys(o)) {
      const path = p ? `${p}.${k}` : k;
      const v = o[k];
      if (typeof v === 'string') {
        n++;
        const ev = getPath(en, path);
        if (typeof ev === 'string' && v === ev) enLike++;
      } else if (isPlainObject(v)) {
        walk(v, path);
      }
    }
  }
  function getPath(root, dotPath) {
    const parts = dotPath.split('.');
    let x = root;
    for (const p of parts) {
      if (x == null || typeof x !== 'object') return undefined;
      x = x[p];
    }
    return x;
  }
  walk(obj, '');
  return { strings: n, stillEnglish: enLike };
}

const stats = countLeaves(merged);
console.log('Wrote locales/he.json and locales/he-IL.json');
console.log('Total string leaves:', stats.strings);
console.log('Leaves still identical to en.default (need Hebrew):', stats.stillEnglish);
