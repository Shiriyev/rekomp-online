import type { Macros } from './types';

/**
 * Recipe browsing (PHASE_2 task 10): quick filters («нет плиты», «без свинины», «до 15
 * мин») and shelves («Можно приготовить», «Курица», …). Pure: the screen passes rows with
 * what it already computed (macros, how many products are missing).
 */

export type BrowseRecipe = {
  id: string;
  sortOrder: number;
  totalMinutes: number;
  ingredientCount: number;
  isBatch: boolean;
  equipment: readonly string[];
  tags: readonly string[];
  mainProtein: string;
  /** TheMealDB area («Italian»), or null. */
  cuisine: string | null;
  /** own (the app's recipes) | mealdb. */
  source: string;
  macros: Macros;
  /** Products not (or not enough) at home for the default servings. */
  missing: number;
  /** Saved by the user («Избранное»). */
  favorite: boolean;
};

/** On/off filters; they combine with AND. */
export const RECIPE_FILTERS = [
  'no_stove',
  'no_oven',
  'no_blender',
  'no_mixer',
  'no_grill',
  'no_microwave',
  'vegetarian',
  'no_pork',
  'no_lactose',
  'no_gluten',
  'cookable',
  'almost',
  'batch',
] as const;
export type RecipeFilter = (typeof RECIPE_FILTERS)[number];

const HEAT = ['stove', 'oven', 'grill', 'microwave', 'multicooker'];

/** «Не хватает ≤ 2»: everything at home, or at most this many products to buy. */
export const ALMOST_MISSING = 2;

const FILTER_TEST: Record<RecipeFilter, (r: BrowseRecipe) => boolean> = {
  no_stove: (r) => !r.equipment.includes('stove'),
  no_oven: (r) => !r.equipment.includes('oven'),
  no_blender: (r) => !r.equipment.includes('blender'),
  no_mixer: (r) => !r.equipment.includes('mixer'),
  no_grill: (r) => !r.equipment.includes('grill'),
  no_microwave: (r) => !r.equipment.includes('microwave'),
  vegetarian: (r) => r.tags.includes('vegetarian'),
  no_pork: (r) => !r.tags.includes('pork'),
  no_lactose: (r) => !r.tags.includes('lactose'),
  no_gluten: (r) => !r.tags.includes('gluten'),
  cookable: (r) => r.missing === 0,
  almost: (r) => r.missing <= ALMOST_MISSING,
  batch: (r) => r.isBatch,
};

/** How the filter sheet groups the on/off filters. */
export const FILTER_GROUPS: readonly { id: string; filters: readonly RecipeFilter[] }[] = [
  { id: 'stock', filters: ['cookable', 'almost'] },
  {
    id: 'equipment',
    filters: ['no_stove', 'no_oven', 'no_blender', 'no_mixer', 'no_grill', 'no_microwave'],
  },
  { id: 'diet', filters: ['vegetarian', 'no_pork', 'no_lactose', 'no_gluten'] },
  { id: 'more', filters: ['batch'] },
];

/** kcal per serving, [from, to). */
export const KCAL_RANGES = {
  upto400: [0, 400],
  from400: [400, 600],
  from600: [600, 800],
  from800: [800, Infinity],
} as const satisfies Record<string, readonly [number, number]>;
export type KcalRange = keyof typeof KCAL_RANGES;
export const KCAL_RANGE_IDS = Object.keys(KCAL_RANGES) as KcalRange[];

/** Choices of the single-pick groups: protein per serving (from), protein per 100 kcal
 * (from), minutes (up to), products (up to). */
export const MIN_PROTEIN = [25, 30, 40, 50] as const;
export const MIN_DENSITY = [8, 10, 12] as const;
export const MAX_MINUTES = [15, 30, 45, 60] as const;
export const MAX_INGREDIENTS = [5, 8, 10] as const;
/** At most this many products for the «Мало ингредиентов» shelf. */
export const FEW_INGREDIENTS = 5;

export const RECIPE_SOURCES = ['own', 'mealdb'] as const;
export type RecipeSource = (typeof RECIPE_SOURCES)[number];

export type RecipeFilterState = {
  toggles: readonly RecipeFilter[];
  /** Main ingredients to keep («Курица» or «Рыба»); empty = all. */
  proteins: readonly string[];
  /** Cuisines to keep; empty = all. */
  cuisines: readonly string[];
  kcal: KcalRange | null;
  minProtein: number | null;
  /** Protein per 100 kcal, at least. */
  minDensity: number | null;
  maxMinutes: number | null;
  maxIngredients: number | null;
  source: RecipeSource | null;
};

export const NO_RECIPE_FILTERS: RecipeFilterState = {
  toggles: [],
  proteins: [],
  cuisines: [],
  kcal: null,
  minProtein: null,
  minDensity: null,
  maxMinutes: null,
  maxIngredients: null,
  source: null,
};

/** How many filters are on (for «Фильтры · 3»). */
export function countRecipeFilters(f: RecipeFilterState): number {
  return (
    f.toggles.length +
    f.proteins.length +
    f.cuisines.length +
    [f.kcal, f.minProtein, f.minDensity, f.maxMinutes, f.maxIngredients, f.source].filter(
      (v) => v !== null,
    ).length
  );
}

/** Protein per 100 kcal of a serving (0 without calories). */
export const proteinDensity = (m: Macros): number => (m.kcal > 0 ? (m.protein / m.kcal) * 100 : 0);

/** Recipes passing every active filter; lists (proteins, cuisines) match any of their items. */
export function applyRecipeFilters<T extends BrowseRecipe>(
  recipes: readonly T[],
  f: RecipeFilterState,
): T[] {
  const tests = f.toggles.map((x) => FILTER_TEST[x]);
  const kcal = f.kcal ? KCAL_RANGES[f.kcal] : null;
  return recipes.filter(
    (r) =>
      tests.every((test) => test(r)) &&
      (f.proteins.length === 0 || f.proteins.includes(r.mainProtein)) &&
      (f.cuisines.length === 0 || (r.cuisine !== null && f.cuisines.includes(r.cuisine))) &&
      (kcal === null || (r.macros.kcal >= kcal[0] && r.macros.kcal < kcal[1])) &&
      (f.minProtein === null || r.macros.protein >= f.minProtein) &&
      (f.minDensity === null || proteinDensity(r.macros) >= f.minDensity) &&
      (f.maxMinutes === null || r.totalMinutes <= f.maxMinutes) &&
      (f.maxIngredients === null || r.ingredientCount <= f.maxIngredients) &&
      (f.source === null || (f.source === 'own') === (r.source === 'own')),
  );
}

/** Cuisines present in `recipes`, most recipes first (for the cuisine chips). */
export function cuisinesOf(recipes: readonly Pick<BrowseRecipe, 'cuisine'>[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) if (r.cuisine) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

export const isNoCookRecipe = (r: Pick<BrowseRecipe, 'equipment'>) =>
  !r.equipment.some((e) => HEAT.includes(e));

/** Shelves in display order; protein shelves follow the generic ones. */
export const SHELVES = [
  'favorites',
  'cookable',
  'almost',
  'no_cook',
  'quick',
  'protein',
  'batch',
  'few_ingredients',
  'poultry',
  'fish',
  'seafood',
  'beef',
  'pork',
  'lamb',
  'eggs',
  'dairy',
  'legumes',
] as const;
export type Shelf = (typeof SHELVES)[number];

/** Minutes for the «Быстро» shelf. */
export const QUICK_MINUTES = 20;

/** «Больше всего белка» shows the top of the list only. */
const PROTEIN_SHELF_SIZE = 20;

const byProtein = (a: BrowseRecipe, b: BrowseRecipe) =>
  b.macros.protein - a.macros.protein || a.sortOrder - b.sortOrder;

/** The recipes of one shelf, in the shelf's order. */
export function shelfRecipes<T extends BrowseRecipe>(recipes: readonly T[], shelf: Shelf): T[] {
  const sorted = (items: T[], cmp: (a: T, b: T) => number) => [...items].sort(cmp);
  switch (shelf) {
    case 'favorites':
      return sorted(
        recipes.filter((r) => r.favorite),
        byProtein,
      );
    case 'cookable':
      return sorted(
        recipes.filter((r) => r.missing === 0),
        byProtein,
      );
    case 'almost':
      return sorted(
        recipes.filter((r) => r.missing >= 1 && r.missing <= 2),
        (a, b) => a.missing - b.missing || byProtein(a, b),
      );
    case 'no_cook':
      return sorted(recipes.filter(isNoCookRecipe), byProtein);
    case 'quick':
      return sorted(
        recipes.filter((r) => r.totalMinutes <= QUICK_MINUTES),
        (a, b) => a.totalMinutes - b.totalMinutes || byProtein(a, b),
      );
    case 'protein':
      return sorted([...recipes], byProtein).slice(0, PROTEIN_SHELF_SIZE);
    case 'batch':
      return sorted(
        recipes.filter((r) => r.isBatch),
        byProtein,
      );
    case 'few_ingredients':
      return sorted(
        recipes.filter((r) => r.ingredientCount <= FEW_INGREDIENTS),
        byProtein,
      );
    default:
      // The rest are protein shelves: «Курица», «Рыба», …
      return sorted(
        recipes.filter((r) => r.mainProtein === shelf),
        byProtein,
      );
  }
}

/** Every non-empty shelf with its recipes. */
export function buildShelves<T extends BrowseRecipe>(
  recipes: readonly T[],
): { shelf: Shelf; recipes: T[] }[] {
  return SHELVES.map((shelf) => ({ shelf, recipes: shelfRecipes(recipes, shelf) })).filter(
    (s) => s.recipes.length > 0,
  );
}
