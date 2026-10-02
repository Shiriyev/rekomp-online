/**
 * build — evaluates every TheMealDB recipe against the reviewed mappings and the recomp
 * criteria. Writes reports/unmapped.md, reports/filter.md and cache/evaluated.json
 * (input for translation and the final catalog).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { evaluate, type Accepted, type Context, type Rejected } from './build/evaluate.ts';
import { loadMappings } from './build/mappings.ts';
import { ensureDir, REPORTS, ROOT } from './lib/paths.ts';
import { loadMealDb } from './mealdb/load.ts';
import { loadUsda } from './usda/load.ts';

const { canonical, ingredientMap, unitGrams, mealExtras } = loadMappings();
const ctx: Context = {
  products: new Map(canonical.map((p) => [p.id, p])),
  map: ingredientMap.map,
  usda: new Map(loadUsda().map((f) => [f.fdcId, f])),
  unitGrams,
  mealExtras,
};

const results = loadMealDb().map((r) => evaluate(r, ctx));
const accepted = results.filter((r): r is Accepted => r.status === 'accepted');
const rejected = results.filter((r): r is Rejected => r.status === 'rejected');

ensureDir(path.join(ROOT, 'cache'));
writeFileSync(path.join(ROOT, 'cache', 'evaluated.json'), JSON.stringify(accepted, null, 1));

// ---------- reports/unmapped.md ----------
const unmappedCount = new Map<string, number>();
for (const r of rejected.filter((x) => x.reason === 'unmapped_ingredient')) {
  for (const name of r.detail.split(', '))
    unmappedCount.set(name, (unmappedCount.get(name) ?? 0) + 1);
}
const unmappedReport = [
  '# Unmapped ingredients',
  '',
  'Ingredients without a canonical product. A recipe that needs one of them is not in the catalog.',
  '',
  `Recipes dropped for this reason: ${rejected.filter((x) => x.reason === 'unmapped_ingredient').length}`,
  '',
  '| Ingredient | Recipes | Reviewer note |',
  '|---|---|---|',
  ...[...unmappedCount]
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `| ${n} | ${c} | ${ingredientMap.unmapped[n] ?? 'not in the map'} |`),
  '',
];
writeFileSync(path.join(REPORTS, 'unmapped.md'), unmappedReport.join('\n'));

// ---------- reports/filter.md ----------
const byReason = new Map<string, Rejected[]>();
for (const r of rejected) byReason.set(r.reason, [...(byReason.get(r.reason) ?? []), r]);
const meals = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const gramsGuesses = accepted.flatMap((a) =>
  a.lines
    .filter((l) => l.gramsSource === 'default')
    .map((l) => `${l.ingredientId} «${l.rawMeasure}»`),
);
const fmt = (n: number) => Math.round(n).toString();
const filterReport = [
  '# Recipe filter',
  '',
  `Recipes in TheMealDB: **${results.length}** · accepted: **${accepted.length}** · rejected: **${rejected.length}**`,
  '',
  '## Rejected by reason',
  '',
  '| Reason | Recipes |',
  '|---|---|',
  ...[...byReason]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([r, list]) => `| ${r} | ${list.length} |`),
  '',
  '## Accepted by meal',
  '',
  '| Meal | Primary | Fits (any) |',
  '|---|---|---|',
  ...meals.map(
    (m) =>
      `| ${m} | ${accepted.filter((a) => a.mealType === m).length} | ${accepted.filter((a) => a.mealTypes.includes(m)).length} |`,
  ),
  '',
  '## Top 20 by protein density',
  '',
  '| Recipe | Meal | Servings | kcal | Protein g | Protein % kcal |',
  '|---|---|---|---|---|---|',
  ...[...accepted]
    .sort((a, b) => b.proteinShare - a.proteinShare)
    .slice(0, 20)
    .map(
      (a) =>
        `| ${a.nameEn} | ${a.mealType} | ${a.servings} | ${fmt(a.perServing.kcal)} | ${fmt(a.perServing.protein)} | ${fmt(a.proteinShare * 100)}% |`,
    ),
  '',
  '## Conversions that used generic defaults (check these)',
  '',
  gramsGuesses.length === 0 ? 'None.' : gramsGuesses.map((g) => `- ${g}`).join('\n'),
  '',
  '## Rejected recipes',
  '',
  ...[...byReason].flatMap(([reason, list]) => [
    `### ${reason} (${list.length})`,
    '',
    ...list.map((r) => `- ${r.nameEn}${r.detail ? ` — ${r.detail}` : ''}`),
    '',
  ]),
];
writeFileSync(path.join(REPORTS, 'filter.md'), filterReport.join('\n'));

console.log(
  `build: ${accepted.length} accepted, ${rejected.length} rejected ` +
    `(${[...byReason].map(([r, l]) => `${r} ${l.length}`).join(', ')})`,
);
