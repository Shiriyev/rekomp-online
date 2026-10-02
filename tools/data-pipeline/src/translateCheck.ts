/**
 * translate:check — validates the final translation of every accepted recipe (hand-written
 * file, API cache, overrides) with the same checks as `translate`, and rewrites
 * reports/needs-review.md. Exits non-zero when a recipe is missing or invalid.
 * `--export` also writes cache/translate-input.json (what a translator needs per recipe).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Accepted } from './build/evaluate.ts';
import { loadMappings } from './build/mappings.ts';
import { REPORTS, ROOT } from './lib/paths.ts';
import { checkTranslation, translationInput } from './translate/check.ts';
import { loadOverrides, loadTranslation } from './translate/load.ts';

const accepted = JSON.parse(
  readFileSync(path.join(ROOT, 'cache', 'evaluated.json'), 'utf8'),
) as Accepted[];
const { translations } = loadMappings();
const all = accepted.map((r) => translationInput(r, translations));
// `--ids a,b,c` checks only those recipes (and leaves needs-review.md alone).
const idsArg = process.argv[process.argv.indexOf('--ids') + 1];
const only = process.argv.includes('--ids') && idsArg ? new Set(idsArg.split(',')) : null;
const inputs = only ? all.filter((i) => only.has(i.id)) : all;

if (process.argv.includes('--export')) {
  writeFileSync(path.join(ROOT, 'cache', 'translate-input.json'), JSON.stringify(all, null, 1));
}

const overrides = loadOverrides();
const problems: { id: string; nameEn: string; errors: string[] }[] = [];
let warned = 0;
for (const input of inputs) {
  let loaded;
  try {
    loaded = loadTranslation(input.id, overrides);
  } catch (e) {
    problems.push({ id: input.id, nameEn: input.nameEn, errors: [`invalid file: ${String(e)}`] });
    continue;
  }
  if (!loaded) {
    problems.push({ id: input.id, nameEn: input.nameEn, errors: ['no translation'] });
    continue;
  }
  const errors = checkTranslation(loaded.translation, input);
  if (errors.length > 0) problems.push({ id: input.id, nameEn: input.nameEn, errors });
  if (loaded.warnings.length > 0) warned++;
}

if (only) {
  for (const p of problems) console.log(`${p.id} ${p.nameEn}:\n  - ${p.errors.join('\n  - ')}`);
} else
  writeFileSync(
    path.join(REPORTS, 'needs-review.md'),
    [
      '# Recipes that need review',
      '',
      'Missing or invalid translations. Fix the file in mappings/recipe-translations/ or add an override.',
      '',
      problems.length === 0
        ? 'None.'
        : problems
            .map((p) => `- **${p.nameEn}** (${p.id})\n  - ${p.errors.join('\n  - ')}`)
            .join('\n'),
      '',
    ].join('\n'),
  );
console.log(
  `translate:check: ${inputs.length} recipes, ${inputs.length - problems.length} valid, ` +
    `${problems.length} need review, ${warned} with long steps`,
);
if (problems.length > 0) process.exitCode = 1;
