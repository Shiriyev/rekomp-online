import type { NutritionIngredient, Unit } from './types';

type ConvertibleIngredient = Pick<NutritionIngredient, 'id' | 'gramsPerPiece'>;

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitConversionError';
  }
}

const gramsPerPieceOf = (ingredient: ConvertibleIngredient): number => {
  const { gramsPerPiece } = ingredient;
  if (gramsPerPiece === null || gramsPerPiece <= 0) {
    throw new UnitConversionError(`Ingredient "${ingredient.id}" has no gramsPerPiece`);
  }
  return gramsPerPiece;
};

/**
 * Converts an amount to grams. Millilitres are treated as grams (density 1),
 * which is accurate enough for the dairy/liquid products the app tracks.
 */
export function toGrams(amount: number, unit: Unit, ingredient: ConvertibleIngredient): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new UnitConversionError(`Invalid amount ${amount} for "${ingredient.id}"`);
  }
  switch (unit) {
    case 'g':
    case 'ml':
      return amount;
    case 'pcs':
      return amount * gramsPerPieceOf(ingredient);
  }
}

/** Converts between units of the same ingredient (pieces need gramsPerPiece). */
export function convertAmount(
  amount: number,
  from: Unit,
  to: Unit,
  ingredient: ConvertibleIngredient,
): number {
  if (from === to) return amount;
  const grams = toGrams(amount, from, ingredient);
  return to === 'pcs' ? grams / gramsPerPieceOf(ingredient) : grams;
}

/** Step for quick +/- buttons in the pantry. */
export function quantityStep(unit: Unit): number {
  return unit === 'pcs' ? 1 : 50;
}

/** Normalises a stored quantity: g/ml are whole numbers, pieces keep halves. */
export function normalizeQuantity(amount: number, unit: Unit): number {
  const clamped = Math.max(0, amount);
  return unit === 'pcs' ? Math.round(clamped * 2) / 2 : Math.round(clamped);
}
