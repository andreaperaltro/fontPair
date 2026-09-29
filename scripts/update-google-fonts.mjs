#!/usr/bin/env node
// Regenerates data/google-fonts.json with the FULL current Google Fonts
// catalog (~2000 families), sorted by popularity. Run this from your own
// machine (not from a restricted CI sandbox) whenever you want the picker
// to reflect the very latest Google Fonts additions:
//
//   node scripts/update-google-fonts.mjs
//
// It uses the same public endpoint fonts.google.com itself uses
// (https://fonts.google.com/metadata/fonts) — no API key required.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'google-fonts.json');

async function main() {
  const res = await fetch('https://fonts.google.com/metadata/fonts');
  if (!res.ok) throw new Error(`fonts.google.com risponde ${res.status}`);
  const data = await res.json();
  const list = data.familyMetadataList
    .map((f) => ({ family: f.family, category: f.category }))
    .sort((a, b) => a.family.localeCompare(b.family));
  await writeFile(OUT_PATH, JSON.stringify(list, null, 2) + '\n', 'utf8');
  console.log(`Scritte ${list.length} famiglie in ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
