/** TheMealDB raw recipes from the fetch cache, as typed objects. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { RAW } from '../lib/paths.ts';

export type RawLine = { ingredient: string; measure: string };

export type MealDbRecipe = {
  id: string;
  name: string;
  category: string;
  area: string;
  instructions: string;
  thumb: string | null;
  tags: string[];
  source: string | null;
  lines: RawLine[];
};

type RawMeal = Record<string, string | null>;

export function toRecipe(m: RawMeal): MealDbRecipe {
  const lines: RawLine[] = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = (m[`strIngredient${i}`] ?? '').trim();
    if (!ingredient) continue;
    lines.push({ ingredient, measure: (m[`strMeasure${i}`] ?? '').trim() });
  }
  return {
    id: m.idMeal ?? '',
    name: (m.strMeal ?? '').trim(),
    category: m.strCategory ?? '',
    area: m.strArea ?? '',
    instructions: (m.strInstructions ?? '').trim(),
    thumb: m.strMealThumb ?? null,
    tags: (m.strTags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    source: m.strSource || null,
    lines,
  };
}

/** Every cached recipe, de-duplicated by id. */
export function loadMealDb(): MealDbRecipe[] {
  const dir = path.join(RAW, 'mealdb');
  const byId = new Map<string, MealDbRecipe>();
  for (const f of readdirSync(dir).filter((f) => f.startsWith('search-'))) {
    const { meals } = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as {
      meals: RawMeal[] | null;
    };
    for (const m of meals ?? []) byId.set(m.idMeal ?? '', toRecipe(m));
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
