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
  macros: Macros;
  /** Products not (or not enough) at home for the default servings. */
  missing: number;
  /** Saved by the user («Избранное»). */
  favorite: boolean;
};

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
  'quick15',
  'quick30',
  'cookable',
  'protein40',
  'few_ingredients',
] as const;
export type RecipeFilter = (typeof RECIPE_FILTERS)[number];

const HEAT = ['stove', 'oven', 'grill', 'microwave', 'multicooker'];

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
  quick15: (r) => r.totalMinutes <= 15,
  quick30: (r) => r.totalMinutes <= 30,
  cookable: (r) => r.missing === 0,
  protein40: (r) => r.macros.protein >= HIGH_PROTEIN_GRAMS,
  few_ingredients: (r) => r.ingredientCount <= FEW_INGREDIENTS,
};

/** How the filter sheet groups the filters. */
export const FILTER_GROUPS: readonly { id: string; filters: readonly RecipeFilter[] }[] = [
  {
    id: 'equipment',
    filters: ['no_stove', 'no_oven', 'no_blender', 'no_mixer', 'no_grill', 'no_microwave'],
  },
  { id: 'diet', filters: ['vegetarian', 'no_pork', 'no_lactose', 'no_gluten'] },
  { id: 'time', filters: ['quick15', 'quick30'] },
  { id: 'more', filters: ['cookable', 'protein40', 'few_ingredients'] },
];

/** At most this many products for «Мало ингредиентов». */
export const FEW_INGREDIENTS = 5;
/** Protein per serving for «Белок от 40 г». */
export const HIGH_PROTEIN_GRAMS = 40;

/**
 * Recipes passing every active filter (filters combine with AND); `proteins`, when not
 * empty, keeps recipes whose main protein is any of them («Курица» or «Рыба»).
 */
export function applyRecipeFilters<T extends BrowseRecipe>(
  recipes: readonly T[],
  active: ReadonlySet<RecipeFilter>,
  proteins: ReadonlySet<string> = new Set(),
): T[] {
  const tests = [...active].map((f) => FILTER_TEST[f]);
  return recipes.filter(
    (r) => tests.every((test) => test(r)) && (proteins.size === 0 || proteins.has(r.mainProtein)),
  );
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
