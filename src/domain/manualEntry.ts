import { ingredientMacros, roundKcal, roundProtein } from './nutrition';
import type { PantryStock, Shortage } from './pantry';
import type { Macros, NutritionIngredient, Unit } from './types';
import { convertAmount, normalizeQuantity } from './units';

/** A product picked in the manual entry form: how much of it was eaten (ingredient unit). */
export type DeductionItem = { ingredientId: string; amount: number };

/** Stepper step in the form: 50 g / 10 ml / 1 шт. */
export function deductionStep(unit: Unit): number {
  return unit === 'g' ? 50 : unit === 'ml' ? 10 : 1;
}

/** Initial amount when a product is ticked: a typical portion, but not more than is at home. */
export function defaultDeductionAmount(unit: Unit, available: number): number {
  const typical = unit === 'pcs' ? 1 : 100;
  return available > 0 ? Math.min(typical, normalizeQuantity(available, unit)) : typical;
}

export type DeductionLine = {
  ingredientId: string;
  unit: Unit;
  /** Asked for. */
  amount: number;
  available: number;
  /** What will actually be taken (never more than is at home). */
  taken: number;
  /** Left at home afterwards. */
  after: number;
};

const ingredientOf = (ingredients: ReadonlyMap<string, NutritionIngredient>, id: string) => {
  const i = ingredients.get(id);
  if (!i) throw new Error(`Unknown ingredient "${id}"`);
  return i;
};

/**
 * What saving the entry takes from the pantry, clamped at zero. Duplicate ingredient ids are
 * merged. `take` is what gets stored on the entry, so Undo returns exactly that.
 */
export function planManualDeduction(
  items: readonly DeductionItem[],
  ingredients: ReadonlyMap<string, NutritionIngredient>,
  pantry: PantryStock,
): { lines: DeductionLine[]; take: Shortage[] } {
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!Number.isFinite(item.amount) || item.amount <= 0) continue;
    merged.set(item.ingredientId, (merged.get(item.ingredientId) ?? 0) + item.amount);
  }

  const lines: DeductionLine[] = [];
  merged.forEach((amount, ingredientId) => {
    const ingredient = ingredientOf(ingredients, ingredientId);
    const unit = ingredient.unit;
    const stock = pantry.get(ingredientId);
    const available = stock ? convertAmount(stock.quantity, stock.unit, unit, ingredient) : 0;
    const taken = Math.min(amount, available);
    lines.push({
      ingredientId,
      unit,
      amount,
      available,
      taken,
      after: normalizeQuantity(available - taken, unit),
    });
  });
  const take = lines
    .filter((l) => l.taken > 0)
    .map((l) => ({ ingredientId: l.ingredientId, amount: l.taken, unit: l.unit }));
  return { lines, take };
}

/** kcal/protein of what was eaten (the asked amounts), rounded as stored. */
export function deductionMacros(
  items: readonly DeductionItem[],
  ingredients: ReadonlyMap<string, NutritionIngredient>,
): Macros {
  const total = items.reduce<Macros>(
    (acc, item) => {
      if (!Number.isFinite(item.amount) || item.amount <= 0) return acc;
      const ingredient = ingredientOf(ingredients, item.ingredientId);
      const m = ingredientMacros(ingredient, item.amount, ingredient.unit);
      return { kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein };
    },
    { kcal: 0, protein: 0 },
  );
  return { kcal: roundKcal(total.kcal), protein: roundProtein(total.protein) };
}
