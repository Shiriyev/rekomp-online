/**
 * validate — PHASE_2 task 6: checks src/db/seed/catalog.v2.json with the app's validator
 * (the same code runs in the app's `npm test`). Exits non-zero on any problem.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { config } from '../pipeline.config.ts';
import { CATALOG_FILE, imageFile } from './catalog.ts';
import { SEED_INGREDIENTS, SEED_RECIPES, validateCatalog, type V1IdMap } from './lib/app.ts';
import { MAPPINGS } from './lib/paths.ts';

const raw: unknown = JSON.parse(readFileSync(CATALOG_FILE, 'utf8'));
const result = validateCatalog(raw, {
  imageExists: (key) => imageFile(key) !== undefined,
  v1Ids: {
    ingredients: SEED_INGREDIENTS.map((i) => i.id),
    recipes: SEED_RECIPES.map((r) => r.id),
  },
  criteriaWarningsOnly: SEED_RECIPES.map((r) => r.id),
  v1IdMap: JSON.parse(readFileSync(path.join(MAPPINGS, 'v1-id-map.json'), 'utf8')) as V1IdMap,
});

// FIXES_v2.1 task 3.1: no grill dish is left (names and steps, both languages); v1 excepted.
const extra: string[] = [];
if (result.ok) {
  const v1 = new Set(SEED_RECIPES.map((r) => r.id));
  const { grillWords, grillIgnore } = config.prune;
  const grill = new RegExp(`(?<![\\p{L}])(${grillWords.join('|')})`, 'iu');
  const ignore = new RegExp(grillIgnore.join('|'), 'giu');
  const c = result.catalog;
  for (const r of c.recipes) {
    if (v1.has(r.id)) continue;
    const steps = c.recipeSteps.filter((s) => s.recipeId === r.id);
    const text = [r.name, r.nameEn, ...steps.flatMap((s) => [s.text, s.textEn])]
      .join('\n')
      .replace(ignore, ' ');
    const m = text.match(grill);
    if (m) extra.push(`recipe ${r.id}: grill («${m[0]}») — task 3.1`);
  }
}
const errors = [...result.errors, ...extra];

if (result.warnings.length > 0)
  console.warn(`validate: ${result.warnings.length} warnings\n- ${result.warnings.join('\n- ')}`);
if (!result.ok || errors.length > 0) {
  console.error(`validate: ${errors.length} problems\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  const c = result.catalog;
  console.log(
    `validate: OK — catalog v${c.catalogVersion}: ${c.ingredients.length} products, ` +
      `${c.recipes.length} recipes, ` +
      `${c.recipeIngredients.length} lines, ${c.recipeSteps.length} steps`,
  );
}
