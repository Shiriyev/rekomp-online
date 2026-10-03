import { resolveLines, type AltChoices } from './nutrition';
import type { Shortage } from './pantry';
import { isStockTracked, type NutritionIngredient, type RecipeLine, type Unit } from './types';
import { convertAmount } from './units';

/** Per-serving amount per ingredient id, in the recipe line's unit. */
export type AmountMap = Readonly<Record<string, number>>;

/**
 * Lines with amounts replaced (draft, «моя версия» or a cook's snapshot). An amount of 0
 * removes the ingredient from this cook; the line stays so it can be brought back.
 */
export function applyAmounts<L extends RecipeLine>(lines: readonly L[], amounts: AmountMap): L[] {
  return lines.map((line) => {
    const amount = amounts[line.ingredientId];
    return amount === undefined ? line : { ...line, amountPerServing: amount };
  });
}

export const isRemoved = (line: Pick<RecipeLine, 'amountPerServing'>): boolean =>
  line.amountPerServing <= 0;

/** Stepper step on the recipe card: 10 g / 10 ml / 1 шт. */
export function draftStep(unit: Unit): number {
  return unit === 'pcs' ? 1 : 10;
}

/** Whole grams/ml; pieces keep halves (½ onion). Never negative. */
export function normalizeDraftAmount(amount: number, unit: Unit): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return unit === 'pcs' ? Math.round(amount * 2) / 2 : Math.round(amount);
}

/**
 * Next draft after setting one amount: values equal to the base are dropped, so an
 * empty draft means «как в рецепте».
 */
export function setDraftAmount(
  draft: AmountMap,
  ingredientId: string,
  amount: number,
  baseAmount: number,
  unit: Unit,
): AmountMap {
  const value = normalizeDraftAmount(amount, unit);
  const { [ingredientId]: _old, ...rest } = draft;
  return Math.abs(value - baseAmount) < 1e-9 ? rest : { ...rest, [ingredientId]: value };
}

/** Full per-serving snapshot of every line (stored with a cook session). */
export function amountSnapshot(lines: readonly RecipeLine[]): Record<string, number> {
  return Object.fromEntries(lines.map((l) => [l.ingredientId, l.amountPerServing]));
}

/**
 * What a cook really uses for all servings, in each ingredient's unit: chosen
 * alternatives only, staples and removed ingredients left out.
 */
export function usedAmounts(
  lines: readonly RecipeLine[],
  ingredients: ReadonlyMap<string, NutritionIngredient>,
  servings: number,
  choices: AltChoices,
): Shortage[] {
  return resolveLines(lines, choices).flatMap((line) => {
    const ingredient = ingredients.get(line.ingredientId);
    if (!ingredient || !isStockTracked(ingredient) || isRemoved(line)) return [];
    const amount = convertAmount(
      line.amountPerServing * servings,
      line.unit,
      ingredient.unit,
      ingredient,
    );
    return [{ ingredientId: line.ingredientId, amount, unit: ingredient.unit }];
  });
}

/** Keeps only finite, non-negative amounts for ingredients the recipe has. */
export function sanitizeAmounts(
  amounts: Readonly<Record<string, unknown>>,
  lines: readonly RecipeLine[],
): Record<string, number> {
  const allowed = new Set(lines.map((l) => l.ingredientId));
  const result: Record<string, number> = {};
  for (const [id, value] of Object.entries(amounts)) {
    if (!allowed.has(id) || typeof value !== 'number') continue;
    if (!Number.isFinite(value) || value < 0 || value > 100_000) continue;
    result[id] = value;
  }
  return result;
}
