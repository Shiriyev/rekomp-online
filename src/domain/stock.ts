import type { Unit } from './types';
import { convertAmount } from './units';

/** Default «заканчивается» threshold when the ingredient has none. */
export function defaultLowStockThreshold(unit: Unit): number {
  return unit === 'pcs' ? 2 : 100;
}

export function isLowStock(quantity: number, unit: Unit, threshold: number | null): boolean {
  return quantity < (threshold ?? defaultLowStockThreshold(unit));
}

type Packaged = { packageSize: number; packageUnit: Unit };
type Convertible = { id: string; unit: Unit; gramsPerPiece: number | null };

/**
 * How much «купил» adds to the pantry, in the ingredient's unit: whole Lidl packages that
 * cover the wanted amount (at least one), or the wanted amount itself without a package.
 */
export function purchaseAmount(
  wanted: { quantity: number | null; unit: Unit | null },
  ingredient: Convertible,
  product: Packaged | undefined,
): number {
  const wantedInUnit =
    wanted.quantity !== null && wanted.unit !== null
      ? convertAmount(wanted.quantity, wanted.unit, ingredient.unit, ingredient)
      : null;

  if (product) {
    const pack = convertAmount(
      product.packageSize,
      product.packageUnit,
      ingredient.unit,
      ingredient,
    );
    if (pack > 0) {
      const packages =
        wantedInUnit === null ? 1 : Math.max(1, Math.ceil(wantedInUnit / pack - 1e-9));
      return packages * pack;
    }
  }
  return wantedInUnit ?? (ingredient.unit === 'pcs' ? 1 : 0);
}
