/**
 * map:draft — every ingredient name used by candidate recipes (not desserts, ≤ max
 * ingredients) with its usage count and the top USDA candidates. Output:
 * reports/map-draft.json, the starting point for the reviewed ingredient map.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { config } from '../pipeline.config.ts';
import { parseMeasure } from './ingredients/measure.ts';
import { normalizeName } from './ingredients/normalize.ts';
import { searchUsda } from './ingredients/usdaSearch.ts';
import { ensureDir, REPORTS } from './lib/paths.ts';
import { loadMealDb } from './mealdb/load.ts';
import { loadUsda } from './usda/load.ts';

const foods = loadUsda();
const recipes = loadMealDb().filter(
  (r) =>
    !config.filter.excludedCategories.includes(r.category) &&
    r.lines.length <= config.filter.maxIngredients,
);

const usage = new Map<string, { count: number; raw: Set<string>; quantified: number }>();
for (const r of recipes) {
  for (const l of r.lines) {
    const name = normalizeName(l.ingredient);
    const entry = usage.get(name) ?? { count: 0, raw: new Set<string>(), quantified: 0 };
    entry.count++;
    entry.raw.add(l.ingredient);
    if (parseMeasure(l.measure).kind === 'amount') entry.quantified++;
    usage.set(name, entry);
  }
}

const draft = [...usage]
  .sort((a, b) => b[1].count - a[1].count)
  .map(([name, u]) => ({
    name,
    count: u.count,
    quantified: u.quantified,
    raw: [...u.raw].slice(0, 5),
    candidates: searchUsda(name, foods).map((c) => `${c.fdcId} ${c.description}`),
  }));

ensureDir(REPORTS);
writeFileSync(path.join(REPORTS, 'map-draft.json'), JSON.stringify(draft, null, 1));
console.log(`map:draft: ${draft.length} names from ${recipes.length} candidate recipes`);
