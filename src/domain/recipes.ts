import type { Macros, MealType } from './types';

export const RECIPE_SORTS = ['protein', 'kcal', 'time'] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

type Sortable = { macros: Macros; totalMinutes: number; sortOrder: number };

/** More protein first / fewer kcal first / quickest first; ties keep the catalog order. */
export function sortRecipes<T extends Sortable>(items: readonly T[], sort: RecipeSort): T[] {
  const key = (x: T) =>
    sort === 'protein' ? -x.macros.protein : sort === 'kcal' ? x.macros.kcal : x.totalMinutes;
  return [...items].sort((a, b) => key(a) - key(b) || a.sortOrder - b.sortOrder);
}

/** Every meal a recipe fits; recipes from before the catalog only know their primary meal. */
export function recipeMeals(r: {
  mealType: MealType;
  mealTypes?: readonly MealType[];
}): readonly MealType[] {
  return r.mealTypes && r.mealTypes.length > 0 ? r.mealTypes : [r.mealType];
}
