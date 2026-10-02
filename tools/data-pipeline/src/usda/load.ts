/**
 * USDA FoodData Central (Foundation + SR Legacy) as a compact index: macros per 100 g and
 * portion weights. Built once from the CSVs and cached as raw/usda/index.json.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'csv-parse/sync';

import { RAW } from '../lib/paths.ts';

export type UsdaPortion = {
  /** e.g. 1 */
  amount: number;
  /** cup, tablespoon, … («undetermined» when only a description is given). */
  unit: string;
  /** e.g. "large", "chopped", "1 clove". */
  modifier: string;
  grams: number;
};

export type UsdaFood = {
  fdcId: number;
  dataset: 'foundation' | 'srLegacy';
  description: string;
  category: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  portions: UsdaPortion[];
};

const NUTRIENTS = { protein: '1003', fat: '1004', carbs: '1005' } as const;
// Energy: the classic value first, then the Atwater ones used by newer Foundation records.
const ENERGY_PRIORITY = ['1008', '2048', '2047'] as const;
const DATA_TYPES = new Set(['foundation_food', 'sr_legacy_food']);

type Row = Record<string, string>;
const csv = (dataset: string, file: string): Row[] =>
  parse(readFileSync(path.join(RAW, 'usda', dataset, file)), {
    columns: true,
    skip_empty_lines: true,
  }) as Row[];

function loadDataset(dataset: 'foundation' | 'srLegacy'): UsdaFood[] {
  const categories = new Map(
    csv(dataset, 'food_category.csv').map((r) => [r.id ?? '', r.description ?? '']),
  );
  const units = new Map(csv(dataset, 'measure_unit.csv').map((r) => [r.id ?? '', r.name ?? '']));
  const foods = new Map<string, UsdaFood>();
  for (const r of csv(dataset, 'food.csv')) {
    if (!DATA_TYPES.has(r.data_type ?? '')) continue;
    foods.set(r.fdc_id ?? '', {
      fdcId: Number(r.fdc_id),
      dataset,
      description: r.description ?? '',
      category: categories.get(r.food_category_id ?? '') ?? '',
      kcal: null,
      protein: null,
      fat: null,
      carbs: null,
      portions: [],
    });
  }

  const energy = new Map<string, Map<string, number>>();
  for (const r of csv(dataset, 'food_nutrient.csv')) {
    const food = foods.get(r.fdc_id ?? '');
    if (!food) continue;
    const id = r.nutrient_id ?? '';
    const amount = Number(r.amount);
    if (!Number.isFinite(amount)) continue;
    if (id === NUTRIENTS.protein) food.protein = amount;
    else if (id === NUTRIENTS.fat) food.fat = amount;
    else if (id === NUTRIENTS.carbs) food.carbs = amount;
    else if ((ENERGY_PRIORITY as readonly string[]).includes(id)) {
      const bucket = energy.get(food.fdcId.toString()) ?? new Map<string, number>();
      bucket.set(id, amount);
      energy.set(food.fdcId.toString(), bucket);
    }
  }
  for (const [fdcId, values] of energy) {
    const food = foods.get(fdcId);
    const id = ENERGY_PRIORITY.find((e) => values.has(e));
    if (food && id) food.kcal = values.get(id) ?? null;
  }

  for (const r of csv(dataset, 'food_portion.csv')) {
    const food = foods.get(r.fdc_id ?? '');
    const grams = Number(r.gram_weight);
    if (!food || !Number.isFinite(grams) || grams <= 0) continue;
    food.portions.push({
      amount: Number(r.amount) || 1,
      unit: units.get(r.measure_unit_id ?? '') ?? 'undetermined',
      modifier: [r.portion_description, r.modifier].filter(Boolean).join(' ').trim(),
      grams,
    });
  }
  return [...foods.values()];
}

const INDEX = path.join(RAW, 'usda', 'index.json');

/** Every Foundation + SR Legacy food with macros; cached after the first build. */
export function loadUsda(): UsdaFood[] {
  if (existsSync(INDEX)) return JSON.parse(readFileSync(INDEX, 'utf8')) as UsdaFood[];
  const foods = [...loadDataset('foundation'), ...loadDataset('srLegacy')];
  writeFileSync(INDEX, JSON.stringify(foods));
  return foods;
}

if (import.meta.main) {
  const foods = loadUsda();
  const withMacros = foods.filter((f) => f.kcal !== null && f.protein !== null);
  console.log(
    `usda index: ${foods.length} foods, ${withMacros.length} with kcal+protein, ` +
      `${foods.filter((f) => f.portions.length > 0).length} with portions`,
  );
}
