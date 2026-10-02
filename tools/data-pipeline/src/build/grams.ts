/**
 * Measure → grams for one canonical product: weights/volumes directly (ml ≈ g, as in the
 * app), then the USDA portion table of that food, then mappings/unit-grams.json
 * (per product, then generic). The source is returned so the report can flag guesses.
 */
import type { Measure, MeasureUnit } from '../ingredients/measure.ts';
import type { UsdaFood, UsdaPortion } from '../usda/load.ts';
import type { Canonical, UnitGrams } from './mappings.ts';

export type GramsResult =
  | { grams: number; source: 'direct' | 'usda' | 'piece' | 'manual' | 'default' }
  | { grams: null; source: 'none' };

/** Words USDA uses for each of our units (in `unit` or at the start of `modifier`). */
const USDA_WORDS: Partial<Record<MeasureUnit, readonly string[]>> = {
  cup: ['cup'],
  tbsp: ['tablespoon', 'tbsp'],
  tsp: ['teaspoon', 'tsp'],
  clove: ['clove'],
  slice: ['slice'],
  stick: ['stick'],
  can: ['can'],
};

function usdaGramsPer(food: UsdaFood | undefined, words: readonly string[]): number | null {
  if (!food) return null;
  const hit = food.portions.find((p: UsdaPortion) => {
    const unit = p.unit.toLowerCase();
    const mod = p.modifier.toLowerCase();
    return words.some((w) => unit.startsWith(w) || mod.startsWith(w) || mod.includes(` ${w}`));
  });
  return hit ? hit.grams / (hit.amount || 1) : null;
}

/** A whole piece: the product's own weight, else a USDA size portion. */
function pieceGrams(
  measure: Extract<Measure, { kind: 'amount' }>,
  product: Canonical,
  food: UsdaFood | undefined,
): number | null {
  if (measure.size) {
    const sized = usdaGramsPer(food, [measure.size]);
    if (sized) return sized;
  }
  if (product.gramsPerPiece) return product.gramsPerPiece;
  return usdaGramsPer(food, [
    'medium',
    'large',
    'whole',
    'piece',
    'fillet',
    'breast',
    'leaf',
    'unit',
  ]);
}

export function measureToGrams(
  measure: Extract<Measure, { kind: 'amount' }>,
  product: Canonical,
  food: UsdaFood | undefined,
  unitGrams: UnitGrams,
): GramsResult {
  const { quantity, unit } = measure;
  if (unit === 'g' || unit === 'ml') return { grams: quantity, source: 'direct' };

  const manual = unitGrams.perProduct[product.id]?.[unit];
  if (manual) return { grams: quantity * manual, source: 'manual' };

  if (unit === 'piece') {
    const g = pieceGrams(measure, product, food);
    return g ? { grams: quantity * g, source: 'piece' } : { grams: null, source: 'none' };
  }

  const words = USDA_WORDS[unit];
  const fromUsda = words ? usdaGramsPer(food, words) : null;
  if (fromUsda) return { grams: quantity * fromUsda, source: 'usda' };

  // A cup of a liquid is ~240 g, a cup of grated cheese ~100 g: the generic cup only
  // applies to products measured by volume.
  if (unit === 'cup' && product.unit !== 'ml') return { grams: null, source: 'none' };
  const generic = unitGrams.default[unit];
  return generic
    ? { grams: quantity * generic, source: 'default' }
    : { grams: null, source: 'none' };
}
