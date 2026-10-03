import { recipeMacros } from '../../domain/nutrition';
import type { NutritionIngredient } from '../../domain/types';

import { proteinCriteria, RECIPE_CRITERIA } from './criteria';
import { CATALOG_CATEGORIES, catalogSchema, type Catalog } from './schema';

/** v1 ids that must survive into the catalog, unless `v1IdMap` says where they went. */
export type V1Ids = { ingredients: string[]; recipes: string[] };
export type V1IdMap = Record<keyof V1Ids, Record<string, string>>;

export type ValidateOptions = {
  /** Whether a bundled image exists for this imageKey. */
  imageExists: (imageKey: string) => boolean;
  v1Ids: V1Ids;
  v1IdMap: V1IdMap;
  /**
   * Recipes reported instead of failed when outside the criteria: the v1 recipes are the
   * owner's own and keep their amounts.
   */
  criteriaWarningsOnly?: readonly string[];
};

export type ValidationResult =
  | { ok: true; catalog: Catalog; errors: []; warnings: string[] }
  | { ok: false; catalog: Catalog | null; errors: string[]; warnings: string[] };

/** Allowed gap between the precomputed per-serving values and the ones from the lines. */
const PRECOMPUTED_TOLERANCE = 0.51;

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/**
 * Validates a catalog file: schema, unique ids and names, references, images, nutrition
 * sanity, recipe criteria and that every v1 id is kept or mapped. Returns every problem
 * found, not just the first.
 */
export function validateCatalog(raw: unknown, options: ValidateOptions): ValidationResult {
  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      catalog: null,
      warnings: [],
      errors: parsed.error.issues
        .slice(0, 50)
        .map((i) => `schema: ${i.path.join('.')}: ${i.message}`),
    };
  }
  const c = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (msg: string) => errors.push(msg);
  const warnOnly = new Set(options.criteriaWarningsOnly ?? []);

  // ---------- unique ids ----------
  for (const [name, ids] of [
    ['ingredient', c.ingredients.map((i) => i.id)],
    ['recipe', c.recipes.map((r) => r.id)],
    ['recipe line', c.recipeIngredients.map((l) => `${l.recipeId}/${l.ingredientId}`)],
    ['recipe step', c.recipeSteps.map((s) => `${s.recipeId}/${s.order}`)],
  ] as const) {
    for (const d of duplicates(ids)) err(`duplicate ${name} id: ${d}`);
  }

  // ---------- products ----------
  const ingredients = new Map(c.ingredients.map((i) => [i.id, i]));
  for (const i of c.ingredients) {
    const subs: readonly string[] = CATALOG_CATEGORIES[i.category];
    if (!subs.includes(i.subcategory))
      err(`ingredient ${i.id}: subcategory ${i.subcategory} is not in ${i.category}`);
    if (i.unit === 'pcs' && i.gramsPerPiece === null)
      err(`ingredient ${i.id}: unit pcs needs gramsPerPiece`);
    // 4 kcal per gram of protein; a little slack for rounding in the sources.
    if (i.proteinPer100g * 4 > i.kcalPer100g * 1.15 + 2)
      err(`ingredient ${i.id}: ${i.proteinPer100g} g protein cannot fit in ${i.kcalPer100g} kcal`);
    const mass = i.proteinPer100g + (i.fatPer100g ?? 0) + (i.carbsPer100g ?? 0);
    if (mass > 101) err(`ingredient ${i.id}: protein + fat + carbs = ${mass} g per 100 g`);
    if (i.imageKey !== null && !options.imageExists(i.imageKey))
      err(`ingredient ${i.id}: image ${i.imageKey} does not exist`);
  }
  const byName = new Map<string, string[]>();
  for (const i of c.ingredients) {
    const key = `${i.category}/${i.subcategory}/${i.name.toLocaleLowerCase('ru')}`;
    byName.set(key, [...(byName.get(key) ?? []), i.id]);
  }
  for (const [key, ids] of byName)
    if (ids.length > 1) err(`duplicate name in ${key}: ${ids.join(', ')}`);

  // ---------- recipes ----------
  const recipes = new Map(c.recipes.map((r) => [r.id, r]));
  const linesOf = new Map<string, typeof c.recipeIngredients>();
  for (const l of c.recipeIngredients) {
    if (!recipes.has(l.recipeId)) err(`line ${l.recipeId}/${l.ingredientId}: unknown recipe`);
    const ing = ingredients.get(l.ingredientId);
    if (!ing) err(`line ${l.recipeId}/${l.ingredientId}: unknown ingredient`);
    else if (l.unit === 'pcs' && ing.gramsPerPiece === null)
      err(`line ${l.recipeId}/${l.ingredientId}: pieces of a product without gramsPerPiece`);
    if (l.amountPerServing === 0 && ing && !ing.isStaple && !l.optional)
      err(`line ${l.recipeId}/${l.ingredientId}: 0 is only allowed for staples`);
    linesOf.set(l.recipeId, [...(linesOf.get(l.recipeId) ?? []), l]);
  }
  const stepsOf = new Map<string, typeof c.recipeSteps>();
  for (const s of c.recipeSteps) {
    if (!recipes.has(s.recipeId)) err(`step ${s.recipeId}/${s.order}: unknown recipe`);
    stepsOf.set(s.recipeId, [...(stepsOf.get(s.recipeId) ?? []), s]);
  }

  const nutrition = new Map<string, NutritionIngredient>(
    c.ingredients.map((i) => [
      i.id,
      {
        id: i.id,
        unit: i.unit,
        gramsPerPiece: i.gramsPerPiece,
        kcalPer100g: i.kcalPer100g,
        proteinPer100g: i.proteinPer100g,
        isStaple: i.isStaple,
      },
    ]),
  );

  for (const r of c.recipes) {
    const lines = linesOf.get(r.id) ?? [];
    const steps = (stepsOf.get(r.id) ?? []).sort((a, b) => a.order - b.order);
    if (lines.length === 0) err(`recipe ${r.id}: no ingredients`);
    if (steps.length === 0) err(`recipe ${r.id}: no steps`);
    if (steps.some((s, i) => s.order !== i + 1)) err(`recipe ${r.id}: step order is not 1..n`);
    if (r.ingredientCount !== lines.length)
      err(`recipe ${r.id}: ingredientCount ${r.ingredientCount}, lines ${lines.length}`);
    const own = new Set(lines.map((l) => l.ingredientId));
    for (const s of steps)
      for (const ref of s.ingredientRefs)
        if (!own.has(ref)) err(`recipe ${r.id} step ${s.order}: ${ref} is not an ingredient`);
    if (!r.mealTypes.includes(r.mealType))
      err(`recipe ${r.id}: mealTypes does not include ${r.mealType}`);
    if (r.imageKey !== null && !options.imageExists(r.imageKey))
      err(`recipe ${r.id}: image ${r.imageKey} does not exist`);
    if (lines.length === 0 || lines.some((l) => !ingredients.has(l.ingredientId))) continue;

    const { perServing } = recipeMacros(lines, nutrition);
    if (Math.abs(perServing.kcal - r.kcalPerServing) > PRECOMPUTED_TOLERANCE)
      err(`recipe ${r.id}: kcalPerServing ${r.kcalPerServing}, lines give ${perServing.kcal}`);
    if (Math.abs(perServing.protein - r.proteinPerServing) > PRECOMPUTED_TOLERANCE)
      err(
        `recipe ${r.id}: proteinPerServing ${r.proteinPerServing}, lines give ${perServing.protein}`,
      );
    const share = perServing.kcal > 0 ? (perServing.protein * 4) / perServing.kcal : 0;
    const criteria = (msg: string) => (warnOnly.has(r.id) ? warnings : errors).push(msg);
    for (const meal of r.mealTypes) {
      const [lo, hi] = RECIPE_CRITERIA.kcalRange[meal];
      const p = proteinCriteria(meal);
      const kcal = Math.round(perServing.kcal);
      if (kcal < lo || kcal > hi)
        criteria(`recipe ${r.id} (${meal}): ${kcal} kcal outside ${lo}–${hi}`);
      if (share < p.minShare - 0.005)
        criteria(
          `recipe ${r.id} (${meal}): protein ${Math.round(share * 100)}% of kcal < ${p.minShare * 100}%`,
        );
      if (perServing.protein < p.minGrams - 0.05)
        criteria(
          `recipe ${r.id} (${meal}): ${perServing.protein.toFixed(1)} g protein < ${p.minGrams} g`,
        );
    }
  }

  // ---------- v1 ids ----------
  const present: Record<keyof V1Ids, Set<string>> = {
    ingredients: new Set(ingredients.keys()),
    recipes: new Set(recipes.keys()),
  };
  for (const kind of ['ingredients', 'recipes'] as const) {
    for (const v1 of options.v1Ids[kind]) {
      const target = options.v1IdMap[kind][v1] ?? v1;
      if (!present[kind].has(target))
        err(`v1 ${kind} id ${v1} is missing${target !== v1 ? ` (mapped to ${target})` : ''}`);
    }
  }

  return errors.length === 0
    ? { ok: true, catalog: c, errors: [], warnings }
    : { ok: false, catalog: c, errors, warnings };
}
