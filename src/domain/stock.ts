import type { Unit } from './types';
import { convertAmount } from './units';

/** Default «заканчивается» threshold when the ingredient has none. */
export function defaultLowStockThreshold(unit: Unit): number {
  return unit === 'pcs' ? 2 : 100;
}

export function isLowStock(quantity: number, unit: Unit, threshold: number | null): boolean {
  return quantity < (threshold ?? defaultLowStockThreshold(unit));
}

type Convertible = { id: string; unit: Unit; gramsPerPiece: number | null };

/**
 * How much «купил» adds to the pantry, in the ingredient's unit: the wanted amount, or
 * 1 шт for a piece product without one.
 */
export function purchaseAmount(
  wanted: { quantity: number | null; unit: Unit | null },
  ingredient: Convertible,
): number {
  if (wanted.quantity !== null && wanted.unit !== null) {
    return convertAmount(wanted.quantity, wanted.unit, ingredient.unit, ingredient);
  }
  return ingredient.unit === 'pcs' ? 1 : 0;
}

/** +/- step for a shopping item: 50 g / 50 ml / 1 шт. */
export function shoppingStep(ingredient: { unit: Unit }): number {
  return ingredient.unit === 'pcs' ? 1 : 50;
}

/**
 * Next amount for a +/- tap: snaps to whole steps, so an odd 120 g with a 50 g step goes
 * to 150 g on «+» instead of 170 g. Never goes below one step.
 */
export function stepQuantity(current: number, step: number, direction: 1 | -1): number {
  const eps = 1e-9;
  if (direction === 1) return (Math.floor(current / step + eps) + 1) * step;
  const down = (Math.ceil(current / step - eps) - 1) * step;
  return Math.max(step, down);
}
