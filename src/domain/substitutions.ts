import type { NutritionIngredient, RecipeLine } from './types';
import { convertAmount, toGrams } from './units';

/** A product that can stand in for another, and how much of it to use. */
export type Substitute = {
  id: string;
  /** Grams of this product per gram of the original; 1 swaps by weight. */
  ratio: number;
};

/** Swaps that hold in any recipe: product id → stand-ins, best first. */
export type SubstitutionRules = ReadonlyMap<string, readonly Substitute[]>;

/** Generated groups carry this prefix so they never collide with the catalog's own. */
export const AUTO_GROUP_PREFIX = 'auto:';

/** Whether a group was generated here rather than written by the catalog. */
export const isAutoGroup = (altGroup: string | null): boolean =>
  altGroup !== null && altGroup.startsWith(AUTO_GROUP_PREFIX);

type Ingredients = ReadonlyMap<string, NutritionIngredient>;

/**
 * Turns the global swaps into extra recipe lines, so resolveLines, autoChoices and
 * canCook can offer stand-ins the recipe itself never spelled out. The original keeps
 * its sortOrder and so stays the group's default.
 *
 * A line is left untouched when the catalog already grouped it (a curated group beats a
 * generic rule), when it is optional, or when every stand-in is unusable here.
 */
export function expandSubstitutions<L extends RecipeLine>(
  lines: readonly L[],
  rules: SubstitutionRules,
  ingredients: Ingredients,
): L[] {
  // A stand-in that is already a line of its own would be counted twice.
  const present = new Set(lines.map((l) => l.ingredientId));
  const out: L[] = [];

  for (const line of lines) {
    const original = ingredients.get(line.ingredientId);
    const subs = rules.get(line.ingredientId);
    if (line.altGroup !== null || line.optional || !original || !subs) {
      out.push(line);
      continue;
    }

    const grams = toGrams(line.amountPerServing, line.unit, original);
    const altGroup = `${AUTO_GROUP_PREFIX}${line.ingredientId}`;
    const standIns: L[] = [];
    for (const sub of subs) {
      const ingredient = ingredients.get(sub.id);
      if (!ingredient || present.has(sub.id)) continue;
      standIns.push({
        ...line,
        ingredientId: sub.id,
        amountPerServing: convertAmount(grams * sub.ratio, 'g', ingredient.unit, ingredient),
        unit: ingredient.unit,
        altGroup,
      });
    }

    if (standIns.length === 0) {
      out.push(line);
      continue;
    }

    out.push({ ...line, altGroup });
    // Fractions keep the stand-ins behind their original and ahead of the next line.
    const step = 1 / (standIns.length + 1);
    standIns.forEach((s, i) => out.push({ ...s, sortOrder: line.sortOrder + step * (i + 1) }));
  }

  return out;
}
