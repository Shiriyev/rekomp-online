import type { Macros, NutritionIngredient, RecipeLine, Unit } from './types';
import { toGrams } from './units';

export type AltChoices = Readonly<Record<string, string>>;

export class MissingIngredientError extends Error {
  constructor(ingredientId: string) {
    super(`Unknown ingredient "${ingredientId}"`);
    this.name = 'MissingIngredientError';
  }
}

/** Macros of a given amount of one ingredient. Staples (salt, spices) always count as zero. */
export function ingredientMacros(
  ingredient: NutritionIngredient,
  amount: number,
  unit: Unit,
): Macros {
  if (ingredient.isStaple) return { kcal: 0, protein: 0 };
  const factor = toGrams(amount, unit, ingredient) / 100;
  return { kcal: ingredient.kcalPer100g * factor, protein: ingredient.proteinPer100g * factor };
}

/**
 * Picks the lines that are actually used: all required lines outside alternative groups,
 * plus exactly one line per alternative group (the chosen one, else the default).
 * Optional lines are excluded.
 */
export function resolveLines<T extends RecipeLine>(
  lines: readonly T[],
  choices: AltChoices = {},
): T[] {
  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const groupPick = new Map<string, T>();
  const included = new Set<T>();

  for (const line of sorted) {
    if (line.optional) continue;
    if (line.altGroup === null) {
      included.add(line);
      continue;
    }
    const isChosen = choices[line.altGroup] === line.ingredientId;
    if (!groupPick.has(line.altGroup) || isChosen) groupPick.set(line.altGroup, line);
  }
  groupPick.forEach((line) => included.add(line));

  return sorted.filter((line) => included.has(line));
}

export type RecipeMacros = { total: Macros; perServing: Macros };

/** Macros of a recipe computed from its ingredients; the single source of truth for kcal/protein. */
export function recipeMacros(
  lines: readonly RecipeLine[],
  ingredients: ReadonlyMap<string, NutritionIngredient>,
  options: { servings?: number; choices?: AltChoices } = {},
): RecipeMacros {
  const servings = options.servings ?? 1;
  if (!Number.isFinite(servings) || servings <= 0) {
    throw new RangeError(`servings must be positive, got ${servings}`);
  }

  const perServing = resolveLines(lines, options.choices).reduce<Macros>(
    (acc, line) => {
      const ingredient = ingredients.get(line.ingredientId);
      if (!ingredient) throw new MissingIngredientError(line.ingredientId);
      const m = ingredientMacros(ingredient, line.amountPerServing, line.unit);
      return { kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein };
    },
    { kcal: 0, protein: 0 },
  );

  return {
    perServing,
    total: { kcal: perServing.kcal * servings, protein: perServing.protein * servings },
  };
}

/** kcal are stored and shown as integers. */
export const roundKcal = (kcal: number): number => Math.round(kcal);

/** Protein is kept as real and shown with one decimal. */
export const roundProtein = (protein: number): number => Math.round(protein * 10) / 10;
