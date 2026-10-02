import { recipeMacros } from './nutrition';
import {
  MEAL_TYPES,
  type Macros,
  type MealType,
  type NutritionIngredient,
  type RecipeLine,
} from './types';
import { recipeMeals } from './recipes';

type LoggedMeal = { mealType: MealType; kcal: number; protein: number };

export type DaySummary = { total: Macros; byMeal: Record<MealType, Macros> };

const zero = (): Macros => ({ kcal: 0, protein: 0 });

/** Totals for one local day, overall and per meal type. */
export function summarizeDay(logs: readonly LoggedMeal[]): DaySummary {
  const byMeal = Object.fromEntries(MEAL_TYPES.map((m) => [m, zero()])) as Record<MealType, Macros>;
  const total = zero();
  for (const log of logs) {
    byMeal[log.mealType].kcal += log.kcal;
    byMeal[log.mealType].protein += log.protein;
    total.kcal += log.kcal;
    total.protein += log.protein;
  }
  return { total, byMeal };
}

export type Targets = { kcalTarget: number; proteinTargetG: number; proteinMinG: number };

export type Remaining = {
  /** Negative when over the target. */
  kcal: number;
  proteinToTarget: number;
  proteinToMin: number;
};

export function remaining(total: Macros, targets: Targets): Remaining {
  return {
    kcal: targets.kcalTarget - total.kcal,
    proteinToTarget: Math.max(0, targets.proteinTargetG - total.protein),
    proteinToMin: Math.max(0, targets.proteinMinG - total.protein),
  };
}

/** Meal type that fits the time of day, used as the default for a new entry. */
export function suggestMealType(date: Date): MealType {
  const h = date.getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 18 || h < 1) return 'dinner';
  return 'snack';
}

export const PROTEIN_NUDGE_FROM_HOUR = 17;
const NUDGE_MIN_GRAMS = 10;

/**
 * "Добери ~X г белка": from late afternoon, if protein is behind the daily minimum,
 * returns how much is missing rounded up to 5 g; otherwise null.
 */
export function proteinNudge(date: Date, proteinEaten: number, proteinMinG: number): number | null {
  if (date.getHours() < PROTEIN_NUDGE_FROM_HOUR) return null;
  const missing = proteinMinG - proteinEaten;
  if (missing < NUDGE_MIN_GRAMS) return null;
  return Math.ceil(missing / 5) * 5;
}

export type Preset = { name: string; kcal: number; protein: number; mealType: MealType };

/** Distinct recent manual entries (by name, case-insensitive), newest first. */
export function recentPresets(manualLogsNewestFirst: readonly Preset[], limit = 6): Preset[] {
  const seen = new Set<string>();
  const result: Preset[] = [];
  for (const log of manualLogsNewestFirst) {
    const key = log.name.trim().toLocaleLowerCase('ru-RU');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name: log.name, kcal: log.kcal, protein: log.protein, mealType: log.mealType });
    if (result.length === limit) break;
  }
  return result;
}

type CatalogRecipe = { id: string; mealType: MealType; mealTypes?: readonly MealType[] };
type CatalogLine = RecipeLine & { recipeId: string };

/** Per-serving macros for every recipe, keyed by recipe id. */
export function catalogMacros(
  recipes: readonly CatalogRecipe[],
  lines: readonly CatalogLine[],
  ingredients: ReadonlyMap<string, NutritionIngredient>,
): Map<string, Macros> {
  const byRecipe = new Map<string, CatalogLine[]>();
  for (const line of lines) {
    const bucket = byRecipe.get(line.recipeId);
    if (bucket) bucket.push(line);
    else byRecipe.set(line.recipeId, [line]);
  }
  return new Map(
    recipes.map((r) => [r.id, recipeMacros(byRecipe.get(r.id) ?? [], ingredients).perServing]),
  );
}

/** kcal span of a meal type across its recipes, for the category tiles. */
export function kcalRangeByMeal(
  recipes: readonly CatalogRecipe[],
  macros: ReadonlyMap<string, Macros>,
): Partial<Record<MealType, { min: number; max: number }>> {
  const result: Partial<Record<MealType, { min: number; max: number }>> = {};
  for (const r of recipes) {
    const kcal = macros.get(r.id)?.kcal;
    if (kcal === undefined) continue;
    for (const meal of recipeMeals(r)) {
      const current = result[meal];
      result[meal] = current
        ? { min: Math.min(current.min, kcal), max: Math.max(current.max, kcal) }
        : { min: kcal, max: kcal };
    }
  }
  return result;
}
