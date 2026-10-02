/**
 * Own recipes (mappings/own-recipes.json): breakfasts and snacks TheMealDB lacks. Amounts
 * are part of the recipe; kcal and protein are computed here from the catalog products
 * (USDA / reviewed manual values) with the app's nutrition code and must pass the same
 * meal criteria as imported recipes.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { config } from '../../pipeline.config.ts';
import { productMacros, type MealType } from '../build/evaluate.ts';
import type { Canonical } from '../build/mappings.ts';
import { recipeMacros, type NutritionIngredient, type RecipeLine } from '../lib/domain.ts';
import { MAPPINGS } from '../lib/paths.ts';
import { translationSchema } from '../translate/check.ts';
import type { UsdaFood } from '../usda/load.ts';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const satisfies readonly MealType[];

export const ownRecipeSchema = z
  .object({
    id: z.string().regex(/^own_[a-z0-9_]+$/),
    nameEn: z.string().min(2),
    mealType: z.enum(MEALS),
    servings: z.number().int().min(1).max(6),
    totalMinutes: z.number().int().positive(),
    /** Whole recipe, grams. 0 = «по вкусу» (staples only). */
    lines: z.array(z.object({ id: z.string(), grams: z.number().min(0) })).min(1),
  })
  .extend(translationSchema.shape)
  .strict();
export type OwnRecipe = z.infer<typeof ownRecipeSchema>;

export function loadOwnRecipes(): OwnRecipe[] {
  const file = path.join(MAPPINGS, 'own-recipes.json');
  if (!existsSync(file)) return [];
  return z.array(ownRecipeSchema).parse(JSON.parse(readFileSync(file, 'utf8')));
}

export type OwnEvaluation = {
  recipe: OwnRecipe;
  perServing: { kcal: number; protein: number };
  proteinShare: number;
  errors: string[];
};

export function evaluateOwn(
  r: OwnRecipe,
  products: ReadonlyMap<string, Canonical>,
  usda: ReadonlyMap<number, UsdaFood>,
): OwnEvaluation {
  const errors: string[] = [];
  const nutrition = new Map<string, NutritionIngredient>();
  const lines: RecipeLine[] = [];
  r.lines.forEach((l, sortOrder) => {
    const p = products.get(l.id);
    if (!p) {
      errors.push(`unknown product "${l.id}"`);
      return;
    }
    if (l.grams === 0 && !p.isStaple) errors.push(`${l.id}: 0 g is only allowed for staples`);
    const m = productMacros(p, usda);
    nutrition.set(p.id, {
      id: p.id,
      unit: 'g',
      gramsPerPiece: p.gramsPerPiece,
      kcalPer100g: m.kcal,
      proteinPer100g: m.protein,
      isStaple: p.isStaple || l.grams === 0,
    });
    lines.push({
      ingredientId: p.id,
      amountPerServing: l.grams / r.servings,
      unit: 'g',
      optional: false,
      altGroup: null,
      sortOrder,
    });
  });
  const ids = new Set(r.lines.map((l) => l.id));
  r.steps.forEach((s, i) => {
    for (const ref of s.ingredientRefs)
      if (!ids.has(ref)) errors.push(`step ${i + 1}: "${ref}" is not a line of this recipe`);
  });
  if (!r.mealTypes.includes(r.mealType)) errors.push(`mealTypes must include ${r.mealType}`);

  const perServing = recipeMacros(lines, nutrition).total;
  const proteinShare = perServing.kcal > 0 ? (perServing.protein * 4) / perServing.kcal : 0;
  const f = config.filter;
  for (const meal of r.mealTypes) {
    const [lo, hi] = f.kcalRange[meal];
    const c = meal === 'snack' ? f.protein.snack : f.protein.main;
    if (perServing.kcal < lo || perServing.kcal > hi)
      errors.push(`${meal}: ${Math.round(perServing.kcal)} kcal outside ${lo}–${hi}`);
    if (proteinShare < c.minShare)
      errors.push(`${meal}: protein ${Math.round(proteinShare * 100)}% < ${c.minShare * 100}%`);
    if (perServing.protein < c.minGrams)
      errors.push(`${meal}: protein ${Math.round(perServing.protein)} g < ${c.minGrams} g`);
  }
  return { recipe: r, perServing, proteinShare, errors };
}
