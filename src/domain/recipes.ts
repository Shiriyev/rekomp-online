import type { Macros, MealType } from './types';

/**
 * Most protein per serving / per 100 kcal, fewest kcal, quickest, and «лучше всего
 * подходит под остаток дня»: closest to the kcal and protein still left for today.
 */
export const RECIPE_SORTS = ['protein', 'proteinPerKcal', 'kcal', 'time', 'fitsDay'] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

type Sortable = { macros: Macros; totalMinutes: number; sortOrder: number };

/** What is left of today's targets (negative kcal when over). */
export type DayLeft = { kcal: number; protein: number };

/**
 * Distance of a serving from what is left today, each part relative to what is left
 * (floored, so a nearly finished day still ranks sensibly): 0 is a perfect fit.
 */
export function dayFit(m: Macros, left: DayLeft): number {
  const kcal = Math.max(left.kcal, 100);
  const protein = Math.max(left.protein, 10);
  return (
    Math.abs(m.kcal - Math.max(left.kcal, 0)) / kcal +
    Math.abs(m.protein - Math.max(left.protein, 0)) / protein
  );
}

/** Sorted copy; ties keep the catalog order. «fitsDay» without `left` keeps that order. */
export function sortRecipes<T extends Sortable>(
  items: readonly T[],
  sort: RecipeSort,
  left?: DayLeft,
): T[] {
  const key = (x: T): number => {
    switch (sort) {
      case 'protein':
        return -x.macros.protein;
      case 'proteinPerKcal':
        return x.macros.kcal > 0 ? -x.macros.protein / x.macros.kcal : 0;
      case 'kcal':
        return x.macros.kcal;
      case 'time':
        return x.totalMinutes;
      case 'fitsDay':
        return left ? dayFit(x.macros, left) : 0;
    }
  };
  return items
    .map((item) => ({ item, k: key(item) }))
    .sort((a, b) => a.k - b.k || a.item.sortOrder - b.item.sortOrder)
    .map((x) => x.item);
}

/** Every meal a recipe fits; recipes from before the catalog only know their primary meal. */
export function recipeMeals(r: {
  mealType: MealType;
  mealTypes?: readonly MealType[];
}): readonly MealType[] {
  return r.mealTypes && r.mealTypes.length > 0 ? r.mealTypes : [r.mealType];
}
