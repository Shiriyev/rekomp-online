import type { Unit } from './types';
import { normalizeQuantity } from './units';

/** Stepper step on the «Количество» screen: 10 g / 10 ml / 1 шт. */
export function bulkStep(unit: Unit): number {
  return unit === 'pcs' ? 1 : 10;
}

/** Default amount to add: what was added last time, else 1 шт / 100 g (ingredient unit). */
export function defaultAddAmount(ingredient: { unit: Unit }, lastAdded: number | null): number {
  if (lastAdded !== null && lastAdded > 0) return normalizeQuantity(lastAdded, ingredient.unit);
  return ingredient.unit === 'pcs' ? 1 : 100;
}

/** Quantity at home after adding (amounts are summed, never replaced). */
export function afterAdding(current: number | null, amount: number, unit: Unit): number {
  return normalizeQuantity((current ?? 0) + Math.max(0, amount), unit);
}
