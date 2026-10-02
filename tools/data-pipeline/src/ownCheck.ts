/** own:check — kcal/protein of every own recipe and whether it meets its meal criteria. */
import { loadMappings } from './build/mappings.ts';
import { checkTranslation } from './translate/check.ts';
import { evaluateOwn, loadOwnRecipes } from './own/recipes.ts';
import { loadUsda } from './usda/load.ts';

const { canonical, translations } = loadMappings();
const products = new Map(canonical.map((p) => [p.id, p]));
const usda = new Map(loadUsda().map((f) => [f.fdcId, f]));

let failed = 0;
for (const r of loadOwnRecipes()) {
  const e = evaluateOwn(r, products, usda);
  // Same text checks as translated recipes (timers need no source text here).
  const textErrors = checkTranslation(
    { ...r, steps: r.steps.map((s) => ({ ...s, timerSec: null })) },
    {
      id: r.id,
      nameEn: r.nameEn,
      category: 'own',
      area: '',
      instructions: '',
      servings: r.servings,
      ingredients: r.lines.map((l) => ({
        id: l.id,
        name: l.id,
        nameRu: translations[l.id]?.ru ?? l.id,
        measure: `${l.grams} g`,
      })),
    },
  );
  const errors = [...e.errors, ...textErrors];
  if (errors.length > 0) failed++;
  console.log(
    `${errors.length ? '✗' : '✓'} ${r.id.padEnd(12)} ${r.mealTypes.join('/').padEnd(16)} ` +
      `${Math.round(e.perServing.kcal)} kcal · ${Math.round(e.perServing.protein)} g protein ` +
      `(${Math.round(e.proteinShare * 100)}%) · ${r.nameRu}` +
      (errors.length ? `\n    - ${errors.join('\n    - ')}` : ''),
  );
}
console.log(`own:check: ${loadOwnRecipes().length} recipes, ${failed} failing`);
if (failed > 0) process.exitCode = 1;
