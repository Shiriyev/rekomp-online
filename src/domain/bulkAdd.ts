import type { Unit } from './types';
import { convertAmount, normalizeQuantity } from './units';

type Convertible = { id: string; unit: Unit; gramsPerPiece: number | null };
type Packaged = { packageSize: number; packageUnit: Unit };

/** Stepper step on the «Количество» screen: 10 g / 10 ml / 1 шт. */
export function bulkStep(unit: Unit): number {
  return unit === 'pcs' ? 1 : 10;
}

/**
 * Default amount to add: the Lidl package size, else what was added last time, else
 * 1 шт / 100 g. Always in the ingredient's unit.
 */
export function defaultAddAmount(
  ingredient: Convertible,
  product: Packaged | undefined,
  lastAdded: number | null,
): number {
  if (product) {
    const pack = convertAmount(
      product.packageSize,
      product.packageUnit,
      ingredient.unit,
      ingredient,
    );
    if (pack > 0) return normalizeQuantity(pack, ingredient.unit);
  }
  if (lastAdded !== null && lastAdded > 0) return normalizeQuantity(lastAdded, ingredient.unit);
  return ingredient.unit === 'pcs' ? 1 : 100;
}

/** Quantity at home after adding (amounts are summed, never replaced). */
export function afterAdding(current: number | null, amount: number, unit: Unit): number {
  return normalizeQuantity((current ?? 0) + Math.max(0, amount), unit);
}

/** Smallest Lidl package per ingredient (default amount and step source). */
export function smallestPackages<P extends Packaged & { ingredientId: string }>(
  products: readonly P[],
): Map<string, P> {
  const map = new Map<string, P>();
  for (const p of products) {
    const current = map.get(p.ingredientId);
    if (!current || p.packageSize < current.packageSize) map.set(p.ingredientId, p);
  }
  return map;
}
