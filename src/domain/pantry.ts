import { resolveLines, type AltChoices } from './nutrition';
import type { NutritionIngredient, RecipeLine, Unit } from './types';
import { convertAmount } from './units';

/** What is at home, keyed by ingredient id, in the ingredient's own unit. */
export type PantryStock = ReadonlyMap<string, { quantity: number; unit: Unit }>;

export type LineAvailability = 'ok' | 'low' | 'missing';

export type LineCheck<L extends RecipeLine = RecipeLine> = {
  line: L;
  /** Required amount for the requested servings, in the ingredient's unit. */
  required: number;
  available: number;
  unit: Unit;
  status: LineAvailability;
  /** Other interchangeable ingredients in the same group. */
  alternatives: string[];
};

export type Shortage = { ingredientId: string; amount: number; unit: Unit };

export type CookCheck<L extends RecipeLine = RecipeLine> = {
  /** ok: everything at home; partial: some; none: no tracked ingredient at all. */
  status: 'ok' | 'partial' | 'none';
  lines: LineCheck<L>[];
  missing: Shortage[];
  choices: AltChoices;
};

// Absorbs float noise such as 0.1 + 0.2 when comparing amounts.
const EPSILON = 1e-6;

type Ingredients = ReadonlyMap<string, NutritionIngredient>;

const ingredientOf = (ingredients: Ingredients, id: string): NutritionIngredient => {
  const i = ingredients.get(id);
  if (!i) throw new Error(`Unknown ingredient "${id}"`);
  return i;
};

function requirement(
  line: RecipeLine,
  ingredients: Ingredients,
  pantry: PantryStock,
  servings: number,
) {
  const ingredient = ingredientOf(ingredients, line.ingredientId);
  const required = convertAmount(
    line.amountPerServing * servings,
    line.unit,
    ingredient.unit,
    ingredient,
  );
  const stock = pantry.get(line.ingredientId);
  const available = stock
    ? convertAmount(stock.quantity, stock.unit, ingredient.unit, ingredient)
    : 0;
  return { ingredient, required, available };
}

/**
 * Picks one ingredient per alternative group: the default when there is enough of it,
 * else the first one there is enough of, else the one covering the largest share.
 */
export function autoChoices(
  lines: readonly RecipeLine[],
  ingredients: Ingredients,
  pantry: PantryStock,
  servings: number,
): AltChoices {
  const groups = new Map<string, RecipeLine[]>();
  for (const line of [...lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (line.optional || line.altGroup === null) continue;
    const bucket = groups.get(line.altGroup);
    if (bucket) bucket.push(line);
    else groups.set(line.altGroup, [line]);
  }

  const choices: Record<string, string> = {};
  groups.forEach((members, group) => {
    let best = members[0]!;
    let bestCoverage = -1;
    for (const m of members) {
      const { required, available } = requirement(m, ingredients, pantry, servings);
      const coverage = required === 0 ? 1 : Math.min(available / required, 1);
      if (coverage >= 1 - EPSILON) {
        best = m;
        break;
      }
      if (coverage > bestCoverage) {
        best = m;
        bestCoverage = coverage;
      }
    }
    choices[group] = best.ingredientId;
  });
  return choices;
}

/** Whether a recipe can be cooked from the pantry for the given servings. Staples are not tracked. */
export function canCook<L extends RecipeLine>(
  lines: readonly L[],
  ingredients: Ingredients,
  pantry: PantryStock,
  servings: number,
  choices: AltChoices = autoChoices(lines, ingredients, pantry, servings),
): CookCheck<L> {
  if (!Number.isFinite(servings) || servings <= 0) {
    throw new RangeError(`servings must be positive, got ${servings}`);
  }

  const checks: LineCheck<L>[] = [];
  for (const line of resolveLines(lines, choices)) {
    const { ingredient, required, available } = requirement(line, ingredients, pantry, servings);
    if (ingredient.isStaple) continue;
    const status: LineAvailability =
      available >= required - EPSILON ? 'ok' : available > EPSILON ? 'low' : 'missing';
    const alternatives =
      line.altGroup === null
        ? []
        : lines
            .filter((l) => l.altGroup === line.altGroup && l.ingredientId !== line.ingredientId)
            .map((l) => l.ingredientId);
    checks.push({ line, required, available, unit: ingredient.unit, status, alternatives });
  }

  const missing = checks
    .filter((c) => c.status !== 'ok')
    .map((c) => ({
      ingredientId: c.line.ingredientId,
      amount: c.required - c.available,
      unit: c.unit,
    }));
  const status =
    missing.length === 0 ? 'ok' : checks.every((c) => c.status === 'missing') ? 'none' : 'partial';

  return { status, lines: checks, missing, choices };
}
