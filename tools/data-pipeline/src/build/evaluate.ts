/**
 * One TheMealDB recipe → accepted catalog recipe or a single rejection reason (PHASE_2
 * tasks 2–3). Numbers come only from the reviewed mappings and USDA, never from a model.
 */
import { config } from '../../pipeline.config.ts';
import { parseMeasure } from '../ingredients/measure.ts';
import { normalizeName } from '../ingredients/normalize.ts';
import { recipeMacros, type NutritionIngredient, type RecipeLine } from '../lib/domain.ts';
import type { MealDbRecipe } from '../mealdb/load.ts';
import type { UsdaFood } from '../usda/load.ts';
import { measureToGrams, type GramsResult } from './grams.ts';
import type { Canonical, UnitGrams } from './mappings.ts';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEALS: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type RecipeTag = 'vegetarian' | 'vegan' | 'pork' | 'alcohol' | 'lactose' | 'gluten';

export type EvaluatedLine = {
  ingredientId: string;
  /** Whole recipe, grams (staples: 0, «по вкусу»). */
  grams: number;
  staple: boolean;
  rawMeasure: string;
  rawName: string;
  gramsSource: GramsResult['source'] | 'unquantified';
};

export type Accepted = {
  status: 'accepted';
  id: string;
  sourceId: string;
  nameEn: string;
  category: string;
  area: string;
  instructions: string;
  thumb: string | null;
  mealType: MealType;
  mealTypes: MealType[];
  servings: number;
  perServing: { kcal: number; protein: number };
  proteinShare: number;
  estimatedMinutes: number | null;
  tags: RecipeTag[];
  lines: EvaluatedLine[];
};

export type RejectReason =
  | 'excluded'
  | 'dessert'
  | 'too_many_ingredients'
  | 'unmapped_ingredient'
  | 'no_grams'
  | 'alcohol_based'
  | 'too_long'
  | 'no_serving_fits'
  | 'low_protein';

export type Rejected = {
  status: 'rejected';
  sourceId: string;
  nameEn: string;
  reason: RejectReason;
  detail: string;
};

export type Context = {
  products: ReadonlyMap<string, Canonical>;
  map: Readonly<Record<string, string>>;
  usda: ReadonlyMap<number, UsdaFood>;
  unitGrams: UnitGrams;
  /** Reviewed extra meals per recipe id (mappings/meal-extras.json), e.g. an omelette as breakfast. */
  mealExtras?: Readonly<Record<string, readonly MealType[]>>;
  /** Reviewed exclusions with the reason (mappings/excluded-recipes.json). */
  excluded?: Readonly<Record<string, string>>;
};

/** Macros per 100 g the app will store for a product (manual values win). */
export function productMacros(
  p: Canonical,
  usda: ReadonlyMap<number, UsdaFood>,
): { kcal: number; protein: number; fat: number | null; carbs: number | null } {
  if (p.manualMacros) return p.manualMacros;
  const f = p.usdaFdcId === null ? undefined : usda.get(p.usdaFdcId);
  if (!f || f.kcal === null || f.protein === null) {
    throw new Error(`Product ${p.id}: USDA ${p.usdaFdcId} has no kcal/protein`);
  }
  return { kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs };
}

const PASSIVE =
  /\b(marinat\w*|overnight|soak\w*|chill\w*|refrigerat\w*|fridge|rest\w*|leave (?:it )?to|stand\w*|set aside|cool\w*|prove|rise)\b/i;

/** Meals a TheMealDB category may serve; the kcal fit then decides. */
export function allowedMeals(category: string): readonly MealType[] {
  if (category === 'Breakfast') return ['breakfast'];
  if (category === 'Side' || category === 'Starter') return ['snack'];
  return ['lunch', 'dinner'];
}

/**
 * Rough total time from the instructions: explicit «N minutes» / «N hours» added up.
 * Null when the text states no durations (then the time filter does not apply).
 */
export function estimateMinutes(instructions: string): number | null {
  let total = 0;
  let found = false;
  const re =
    /(\d+(?:[.,]\d+)?)(?:\s*(?:-|to)\s*(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|minutes?|mins?)\b/gi;
  // Waiting is not cooking: marinating, soaking, chilling or resting does not count.
  const sentences = instructions.split(/(?<=[.!?\n])\s+/);
  for (const sentence of sentences) {
    if (PASSIVE.test(sentence)) continue;
    for (const m of sentence.matchAll(re)) {
      const value = Number((m[2] ?? m[1])!.replace(',', '.'));
      if (!Number.isFinite(value)) continue;
      total += /^h/i.test(m[3]!) ? value * 60 : value;
      found = true;
    }
  }
  return found ? Math.round(total) : null;
}

const reject = (r: MealDbRecipe, reason: RejectReason, detail = ''): Rejected => ({
  status: 'rejected',
  sourceId: r.id,
  nameEn: r.name,
  reason,
  detail,
});

export function evaluate(r: MealDbRecipe, ctx: Context): Accepted | Rejected {
  const f = config.filter;
  const excluded = ctx.excluded?.[`mdb_${r.id}`];
  if (excluded) return reject(r, 'excluded', excluded);
  if (f.excludedCategories.includes(r.category)) return reject(r, 'dessert', r.category);
  if (r.lines.length > f.maxIngredients) {
    return reject(r, 'too_many_ingredients', String(r.lines.length));
  }

  const lines: EvaluatedLine[] = [];
  const unmapped: string[] = [];
  const noGrams: string[] = [];
  for (const raw of r.lines) {
    const name = normalizeName(raw.ingredient);
    const id = ctx.map[name];
    const product = id ? ctx.products.get(id) : undefined;
    const measure = parseMeasure(raw.measure);
    if (!product) {
      unmapped.push(name);
      continue;
    }
    if (product.isStaple || measure.kind === 'unquantified') {
      lines.push({
        ingredientId: product.id,
        grams: 0,
        staple: true,
        rawMeasure: raw.measure,
        rawName: raw.ingredient,
        gramsSource: 'unquantified',
      });
      continue;
    }
    const food = product.usdaFdcId === null ? undefined : ctx.usda.get(product.usdaFdcId);
    const g = measureToGrams(measure, product, food, ctx.unitGrams);
    if (g.grams === null) {
      noGrams.push(`${product.id} (${measure.unit})`);
      continue;
    }
    lines.push({
      ingredientId: product.id,
      grams: g.grams,
      staple: false,
      rawMeasure: raw.measure,
      rawName: raw.ingredient,
      gramsSource: g.source,
    });
  }
  if (unmapped.length > 0) return reject(r, 'unmapped_ingredient', unmapped.join(', '));
  if (noGrams.length > 0) return reject(r, 'no_grams', noGrams.join(', '));

  // Merge repeated products (e.g. two lines of olive oil).
  const merged = new Map<string, EvaluatedLine>();
  for (const l of lines) {
    const prev = merged.get(l.ingredientId);
    if (prev)
      merged.set(l.ingredientId, {
        ...prev,
        grams: prev.grams + l.grams,
        staple: prev.staple && l.staple,
      });
    else merged.set(l.ingredientId, l);
  }
  const finalLines = [...merged.values()];

  const totalGrams = finalLines.reduce((s, l) => s + l.grams, 0);
  const alcoholGrams = finalLines
    .filter((l) => ctx.products.get(l.ingredientId)?.tags.includes('alcohol'))
    .reduce((s, l) => s + l.grams, 0);
  if (totalGrams > 0 && alcoholGrams / totalGrams > f.maxAlcoholShare) {
    return reject(r, 'alcohol_based', `${Math.round((alcoholGrams / totalGrams) * 100)}%`);
  }

  const minutes = estimateMinutes(r.instructions);
  if (minutes !== null && minutes > f.maxMinutes) return reject(r, 'too_long', `${minutes} min`);

  // Total macros through the app's own nutrition code (lines in grams, one «serving»).
  const nutrition = new Map<string, NutritionIngredient>();
  const recipeLines: RecipeLine[] = [];
  finalLines.forEach((l, sortOrder) => {
    const p = ctx.products.get(l.ingredientId)!;
    const m = productMacros(p, ctx.usda);
    nutrition.set(p.id, {
      id: p.id,
      unit: 'g',
      gramsPerPiece: p.gramsPerPiece,
      kcalPer100g: m.kcal,
      proteinPer100g: m.protein,
      isStaple: p.isStaple || l.staple,
    });
    recipeLines.push({
      ingredientId: p.id,
      amountPerServing: l.grams,
      unit: 'g',
      optional: false,
      altGroup: null,
      sortOrder,
    });
  });
  const total = recipeMacros(recipeLines, nutrition).total;
  if (total.kcal <= 0) return reject(r, 'no_serving_fits', '0 kcal');
  const proteinShare = (total.protein * 4) / total.kcal;

  // Which meals fit, and with how many servings.
  const base = allowedMeals(r.category);
  const extra = (ctx.mealExtras?.[`mdb_${r.id}`] ?? []).filter((m) => !base.includes(m));
  const fits: { meal: MealType; servings: number; distance: number }[] = [];
  for (const meal of [...base, ...extra]) {
    const [lo, hi] = f.kcalRange[meal];
    for (let n = f.servings.min; n <= f.servings.max; n++) {
      const kcal = total.kcal / n;
      if (kcal >= lo && kcal <= hi)
        fits.push({ meal, servings: n, distance: Math.abs(kcal - (lo + hi) / 2) });
    }
  }
  if (fits.length === 0) {
    return reject(r, 'no_serving_fits', `${Math.round(total.kcal)} kcal total`);
  }

  const criteria = (meal: MealType) => (meal === 'snack' ? f.protein.snack : f.protein.main);
  const passing = fits.filter((x) => {
    const c = criteria(x.meal);
    return proteinShare >= c.minShare && total.protein / x.servings >= c.minGrams;
  });
  if (passing.length === 0) {
    const best = fits[0]!;
    return reject(
      r,
      'low_protein',
      `${Math.round(proteinShare * 100)}% kcal, ${Math.round(total.protein / best.servings)} g/serving`,
    );
  }

  // The category's own meals decide the servings; reviewed extras only add meals that fit
  // with the same servings, or carry a recipe that fits nothing else.
  const fromBase = passing.filter((x) => base.includes(x.meal));
  const best = [...(fromBase.length > 0 ? fromBase : passing)].sort(
    (a, b) => a.distance - b.distance,
  )[0]!;
  // One recipe has one serving size: list only meals that fit with that size.
  const mealTypes = MEALS.filter((m) =>
    passing.some((x) => x.meal === m && x.servings === best.servings),
  );

  const products = finalLines.map((l) => ctx.products.get(l.ingredientId)!);
  const tags = new Set<RecipeTag>();
  for (const t of ['pork', 'alcohol', 'lactose', 'gluten'] as const) {
    if (products.some((p) => p.tags.includes(t))) tags.add(t);
  }
  if (products.every((p) => p.tags.includes('vegetarian'))) tags.add('vegetarian');
  if (products.every((p) => p.tags.includes('vegan'))) tags.add('vegan');

  return {
    status: 'accepted',
    id: `mdb_${r.id}`,
    sourceId: r.id,
    nameEn: r.name,
    category: r.category,
    area: r.area,
    instructions: r.instructions,
    thumb: r.thumb,
    mealType: best.meal,
    mealTypes,
    servings: best.servings,
    perServing: { kcal: total.kcal / best.servings, protein: total.protein / best.servings },
    proteinShare,
    estimatedMinutes: minutes,
    tags: [...tags],
    lines: finalLines,
  };
}
