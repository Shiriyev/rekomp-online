import type { IngredientCategory } from './types';

/**
 * Product browsing (PHASE_2 task 9): category → subcategory chips, a filter sheet (stock,
 * used in recipes, high protein, kcal per 100 g, diet tags) and sorts. Pure: screens pass
 * what each product looks like (`ProductFacts`) through a key function.
 */

/** At home (any amount), not at home, or running low. */
export const PRODUCT_STOCK = ['home', 'missing', 'low'] as const;
export type ProductStock = (typeof PRODUCT_STOCK)[number];

export const PRODUCT_DIETS = ['no_pork', 'vegetarian', 'no_lactose', 'no_gluten'] as const;
export type ProductDiet = (typeof PRODUCT_DIETS)[number];

/** kcal per 100 g, [from, to): lean vegetables … oils and nuts. */
export const PRODUCT_KCAL = {
  upto100: [0, 100],
  from100: [100, 250],
  from250: [250, 400],
  from400: [400, Infinity],
} as const satisfies Record<string, readonly [number, number]>;
export type ProductKcal = keyof typeof PRODUCT_KCAL;
export const PRODUCT_KCAL_IDS = Object.keys(PRODUCT_KCAL) as ProductKcal[];

/** «Высокобелковые»: at least this much protein per 100 g. */
export const HIGH_PROTEIN_PER_100G = 15;

/**
 * «Чаще нужны» (most recipes first), A–Z, protein per 100 g and per 100 kcal (most first),
 * kcal per 100 g (fewest first).
 */
export const PRODUCT_SORTS = ['popular', 'name', 'protein', 'proteinPerKcal', 'kcal'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export type ProductFilters = {
  category: IngredientCategory | null;
  subcategory: string | null;
  stock: ProductStock | null;
  usedInRecipes: boolean;
  highProtein: boolean;
  kcal: ProductKcal | null;
  diets: readonly ProductDiet[];
  sort: ProductSort;
};

export const DEFAULT_PRODUCT_FILTERS: ProductFilters = {
  category: null,
  subcategory: null,
  stock: null,
  usedInRecipes: false,
  highProtein: false,
  kcal: null,
  diets: [],
  sort: 'popular',
};

/** What filters and sorts look at; `name` is the name in the UI language. */
export type ProductFacts = {
  id: string;
  name: string;
  category: IngredientCategory;
  subcategory: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  tags: readonly string[];
  /** Amount at home; null when the product is not there. */
  quantity: number | null;
  low: boolean;
  /** How many recipes use it. */
  uses: number;
};

/** Filters in the sheet that are on (category chips and the sort are not counted). */
export function countProductFilters(f: ProductFilters): number {
  return (
    (f.stock ? 1 : 0) +
    (f.usedInRecipes ? 1 : 0) +
    (f.highProtein ? 1 : 0) +
    (f.kcal ? 1 : 0) +
    f.diets.length
  );
}

const DIET_TEST: Record<ProductDiet, (tags: readonly string[]) => boolean> = {
  no_pork: (tags) => !tags.includes('pork'),
  vegetarian: (tags) => tags.includes('vegetarian'),
  no_lactose: (tags) => !tags.includes('lactose'),
  no_gluten: (tags) => !tags.includes('gluten'),
};

const STOCK_TEST: Record<ProductStock, (p: ProductFacts) => boolean> = {
  home: (p) => p.quantity !== null && p.quantity > 0,
  missing: (p) => p.quantity === null || p.quantity <= 0,
  low: (p) => p.quantity !== null && p.low,
};

/** Everything but the category chips: the counts on those chips come from this. */
function passesSheet(p: ProductFacts, f: ProductFilters): boolean {
  if (f.stock && !STOCK_TEST[f.stock](p)) return false;
  if (f.usedInRecipes && p.uses === 0) return false;
  if (f.highProtein && p.proteinPer100g < HIGH_PROTEIN_PER_100G) return false;
  if (f.kcal) {
    const [from, to] = PRODUCT_KCAL[f.kcal];
    if (p.kcalPer100g < from || p.kcalPer100g >= to) return false;
  }
  return f.diets.every((d) => DIET_TEST[d](p.tags));
}

/** Products passing the sheet filters and the chosen category / subcategory. */
export function applyProductFilters<T>(
  items: readonly T[],
  f: ProductFilters,
  facts: (item: T) => ProductFacts,
): T[] {
  return items.filter((item) => {
    const p = facts(item);
    if (f.category && p.category !== f.category) return false;
    if (f.subcategory && p.subcategory !== f.subcategory) return false;
    return passesSheet(p, f);
  });
}

/**
 * Chip counts: per category, and per subcategory of the chosen category, among the
 * products that pass the sheet filters.
 */
export function productCounts<T>(
  items: readonly T[],
  f: ProductFilters,
  facts: (item: T) => ProductFacts,
): {
  total: number;
  categories: Map<IngredientCategory, number>;
  subcategories: Map<string, number>;
} {
  const categories = new Map<IngredientCategory, number>();
  const subcategories = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    const p = facts(item);
    if (!passesSheet(p, f)) continue;
    total++;
    categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
    if (p.category === f.category && p.subcategory)
      subcategories.set(p.subcategory, (subcategories.get(p.subcategory) ?? 0) + 1);
  }
  return { total, categories, subcategories };
}

// One collator: `localeCompare` builds a new one per call on Hermes.
const collator = new Intl.Collator(['ru', 'en'], { sensitivity: 'base' });

/** Protein per 100 kcal; products without calories (water, salt) go last. */
const proteinPerKcal = (p: ProductFacts) =>
  p.kcalPer100g > 0 ? (p.proteinPer100g / p.kcalPer100g) * 100 : -1;

const SORT_KEY: Record<Exclude<ProductSort, 'name'>, (p: ProductFacts) => number> = {
  popular: (p) => -p.uses,
  protein: (p) => -p.proteinPer100g,
  proteinPerKcal: (p) => -proteinPerKcal(p),
  kcal: (p) => p.kcalPer100g,
};

/** Sorted copy; ties go by name. */
export function sortProductList<T>(
  items: readonly T[],
  sort: ProductSort,
  facts: (item: T) => ProductFacts,
): T[] {
  return items
    .map((item) => ({ item, p: facts(item) }))
    .sort((x, y) => {
      if (sort !== 'name') {
        const diff = SORT_KEY[sort](x.p) - SORT_KEY[sort](y.p);
        if (diff !== 0) return diff;
      }
      return collator.compare(x.p.name, y.p.name);
    })
    .map((x) => x.item);
}
