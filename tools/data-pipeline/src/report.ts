/**
 * report — reports/review.md: every accepted recipe with its Russian name, per-serving
 * kcal/protein (from tasks 2–3) and the final steps, for a quick human read-through.
 * Fixes go into mappings/recipe-overrides.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Accepted } from './build/evaluate.ts';
import { REPORTS, ROOT } from './lib/paths.ts';
import { loadOverrides, loadTranslation } from './translate/load.ts';

const accepted = JSON.parse(
  readFileSync(path.join(ROOT, 'cache', 'evaluated.json'), 'utf8'),
) as Accepted[];
const overrides = loadOverrides();

const fmtTimer = (sec: number) => (sec % 60 === 0 ? `${sec / 60} мин` : `${sec} с`);
let missing = 0;
let warned = 0;
const sections = accepted.map((r) => {
  const head = `${Math.round(r.perServing.kcal)} ккал · белок ${Math.round(r.perServing.protein)} г · ${r.servings} порц. · ${r.mealTypes.join('/')}`;
  const loaded = loadTranslation(r.id, overrides);
  if (!loaded) {
    missing++;
    return [`## ${r.nameEn} (${r.id})`, '', head, '', '_Нет перевода._', ''].join('\n');
  }
  const t = loaded.translation;
  if (loaded.warnings.length > 0) warned++;
  return [
    `## ${t.nameRu} — ${r.nameEn} (${r.id})${loaded.overridden ? ' ✎' : ''}`,
    '',
    head,
    `Модель предлагает: ${t.mealTypes.join('/')}${t.isBatch ? ' · заготовка' : ''}${t.prepNightBefore ? ' · с вечера' : ''}`,
    '',
    `_${t.descriptionRu}_`,
    '',
    ...t.steps.map(
      (s, i) =>
        `${i + 1}. ${s.ru}${s.timerSec ? ` ⏱ ${fmtTimer(s.timerSec)}` : ''}${s.ingredientRefs.length ? ` [${s.ingredientRefs.join(', ')}]` : ''}`,
    ),
    ...(loaded.warnings.length ? ['', ...loaded.warnings.map((w) => `> ⚠ ${w}`)] : []),
    '',
  ].join('\n');
});

writeFileSync(
  path.join(REPORTS, 'review.md'),
  [
    '# Recipe review',
    '',
    `Recipes: ${accepted.length} · without translation: ${missing} · with warnings: ${warned} · ✎ = overridden`,
    '',
    ...sections,
  ].join('\n'),
);
console.log(
  `report: ${accepted.length} recipes, ${missing} without translation, ${warned} with warnings`,
);
