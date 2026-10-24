/**
 * Reviewed lists for the prune step and its report (FIXES_v2.1 task 3.3):
 * mappings/{ingredient,recipe}-{allow,block}list.json → reports/prune-review.md.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { ensureDir, MAPPINGS, REPORTS } from '../lib/paths.ts';
import type { PruneLists, PruneRecipe, PruneResult } from './prune.ts';

const listSchema = z.object({ _comment: z.string().optional(), ids: z.array(z.string()) });

function readList(name: string): Set<string> {
  const file = path.join(MAPPINGS, name);
  if (!existsSync(file)) return new Set();
  return new Set(listSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).ids);
}

const shopsSchema = z.object({
  all: z.array(z.string()),
  super: z.array(z.string()),
  tesco: z.array(z.string()),
});

/**
 * Products a shopper can actually buy, from ingredient-shops.json: every tier but «none».
 * Replaces the single hand-made Lidl list the prune used to ask, which named about 180
 * products and so made ordinary things — lamb, crème fraîche, capers — count as rare.
 */
function readShops(): Set<string> {
  const file = path.join(MAPPINGS, 'ingredient-shops.json');
  if (!existsSync(file)) return readList('ingredient-lidl.json');
  const tiers = shopsSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  return new Set([...tiers.all, ...tiers.super, ...tiers.tesco]);
}

export function loadPruneLists(): PruneLists {
  return {
    ingredientAllow: readList('ingredient-allowlist.json'),
    ingredientShops: readShops(),
    ingredientBlock: readList('ingredient-blocklist.json'),
    recipeAllow: readList('recipe-allowlist.json'),
    recipeBlock: readList('recipe-blocklist.json'),
  };
}

type ReportRecipe = PruneRecipe & { nameRu: string; source: string };

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_RU = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };

const byMeal = (recipes: readonly { mealTypes: readonly string[] }[]) =>
  MEALS.map((m) => recipes.filter((r) => r.mealTypes.includes(m)).length);

export function writePruneReport(
  recipes: readonly ReportRecipe[],
  result: PruneResult,
  productNames: ReadonlyMap<string, string>,
  lists: PruneLists = loadPruneLists(),
): string {
  const kept = recipes.filter((r) => result.keptRecipes.has(r.id));
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const name = (id: string) => productNames.get(id) ?? id;
  const before = byMeal(recipes);
  const after = byMeal(kept);
  const grill = result.removedRecipes.filter((r) => r.reason.kind === 'grill');
  const rare = result.removedRecipes.filter((r) => r.reason.kind === 'rare');
  const blocked = result.removedRecipes.filter((r) => r.reason.kind === 'blocklist');

  const reason = (r: (typeof result.removedRecipes)[number]) => {
    switch (r.reason.kind) {
      case 'blocklist':
        return 'recipe-blocklist';
      case 'grill':
        return `гриль («${r.reason.match}»)${r.reason.adaptable ? ' · можно адаптировать' : ''}`;
      case 'rare':
        return `редкий продукт: ${r.reason.products.map((p) => `${name(p.id)} ×${p.uses}`).join(', ')}`;
    }
  };

  const lines = [
    '# Чистка каталога (FIXES_v2.1, задача 3)',
    '',
    'Сгенерировано `npm run catalog`. Ручные решения: `mappings/recipe-blocklist.json`,',
    '`mappings/recipe-allowlist.json` (id рецепта), `mappings/ingredient-allowlist.json`,',
    '`mappings/ingredient-blocklist.json` (id продукта). 16 рецептов v1 не трогаются.',
    '',
    'Критерий «есть в Lidl»: данные Open Food Facts удалены из каталога в v7, поэтому вместо них —',
    'список `mappings/ingredient-shops.json`: где продукт можно купить (Lidl / Spar / Tesco / Aldi).',
    'Его стоит проверить: всё, что в нём, не считается редким.',
    '',
    '## Итог',
    '',
    '| | до | после |',
    '|---|---:|---:|',
    `| Рецептов | ${recipes.length} | ${kept.length} |`,
    ...MEALS.map((m, i) => `| — ${MEAL_RU[m]} | ${before[i]} | ${after[i]} |`),
    `| Продуктов | ${productNames.size} | ${result.keptProducts.size} |`,
    '',
    `Удалено рецептов: ${result.removedRecipes.length} (гриль ${grill.length}, редкие продукты ${rare.length}, вручную ${blocked.length}).`,
    `Удалено продуктов: ${result.removedProducts.length}.`,
    '',
    'Число использований считается один раз, по рецептам после шага «гриль» (порядок спеки:',
    'посчитать → убрать блюда → убрать неиспользуемые продукты). После чистки у оставшихся',
    `блюд продуктов вне белого списка и Lidl с < 3 использованиями: ${
      [...result.uses].filter(
        ([id, n]) => n < 3 && !lists.ingredientAllow.has(id) && !lists.ingredientShops.has(id),
      ).length
    } (каскадный пересчёт — \`prune.cascade\` в конфиге — оставил бы только свои блюда).`,
    '',
    '## Удалённые рецепты',
    '',
    '| id | Название | Приёмы пищи | Причина |',
    '|---|---|---|---|',
    ...result.removedRecipes.map((r) => {
      const ru = byId.get(r.id)?.nameRu ?? r.nameEn;
      return `| ${r.id} | ${ru} (${r.nameEn}) | ${r.mealTypes.join(', ')} | ${reason(r)} |`;
    }),
    '',
    '## Гриль: можно адаптировать на сковороде',
    '',
    'Исключены, не адаптированы. Чтобы вернуть, добавь id в `recipe-allowlist.json`',
    '(и поправь шаги в `recipe-overrides.json`).',
    '',
    ...grill
      .filter((r) => r.reason.kind === 'grill' && r.reason.adaptable)
      .map((r) => `- ${r.id} — ${byId.get(r.id)?.nameRu ?? r.nameEn} (${r.nameEn})`),
    '',
    '## Убраны необязательные продукты (рецепт остался)',
    '',
    ...[...result.droppedLines].map(
      ([id, products]) =>
        `- ${id} — ${byId.get(id)?.nameRu ?? id}: ${products.map(name).join(', ')}`,
    ),
    '',
    '## На грани',
    '',
    'Остались, но обязательный продукт используется ровно на пороге `minRecipeUses` —',
    'удаление ещё одного блюда с ним уберёт и эти.',
    '',
    ...result.borderline.map(
      (b) =>
        `- ${b.id} — ${byId.get(b.id)?.nameRu ?? b.nameEn}: ${b.products.map((p) => `${name(p.id)} ×${p.uses}`).join(', ')}`,
    ),
    '',
    '## Оставшиеся рецепты по приёмам пищи',
    '',
    ...MEALS.flatMap((m) => [
      `### ${MEAL_RU[m]} (${kept.filter((r) => r.mealTypes.includes(m)).length})`,
      '',
      ...kept
        .filter((r) => r.mealTypes.includes(m))
        .map((r) => `- ${r.id} — ${r.nameRu}${r.source === 'own' ? ' · свой' : ''}`),
      '',
    ]),
    '## Удалённые продукты',
    '',
    ...result.removedProducts.map((id) => `- ${id} — ${name(id)}`),
    '',
  ];
  const file = path.join(ensureDir(REPORTS), 'prune-review.md');
  writeFileSync(file, lines.join('\n'));
  return file;
}
