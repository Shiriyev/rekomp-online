/** Shared domain vocabulary. Pure types and constants: no React, no DB. */

export const UNITS = ['g', 'ml', 'pcs'] as const;
export type Unit = (typeof UNITS)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Product categories of the catalog (PHASE_2), in display order. */
export const INGREDIENT_CATEGORIES = [
  'dairy_eggs',
  'meat_poultry',
  'fish_seafood',
  'grains_pasta_legumes',
  'vegetables',
  'fruits_berries',
  'bread_bakery',
  'nuts_seeds',
  'sauces_oils_spices',
  'other',
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

/** v1 categories (old installs and backups) → catalog categories. */
export const LEGACY_CATEGORIES: Readonly<Record<string, IngredientCategory>> = {
  dairy: 'dairy_eggs',
  eggs: 'dairy_eggs',
  meat: 'meat_poultry',
  grains: 'grains_pasta_legumes',
  vegetables: 'vegetables',
  fruits: 'fruits_berries',
  bread: 'bread_bakery',
  canned: 'other',
  oil: 'sauces_oils_spices',
  spices: 'sauces_oils_spices',
};

export const MEAL_LOG_SOURCES = ['recipe', 'portion', 'manual'] as const;
export type MealLogSource = (typeof MEAL_LOG_SOURCES)[number];

/** Minimal ingredient shape needed for unit conversion and nutrition. */
export type NutritionIngredient = {
  id: string;
  unit: Unit;
  gramsPerPiece: number | null;
  kcalPer100g: number;
  proteinPer100g: number;
  isStaple: boolean;
  /**
   * false: not kept track of at home (broth: made from water and a cube). Counted in
   * nutrition, never «missing», never deducted. Absent means tracked.
   */
  stockTracked?: boolean;
};

/** Whether stock at home is checked and deducted for this product (staples and broth: no). */
export const isStockTracked = (i: Pick<NutritionIngredient, 'isStaple' | 'stockTracked'>) =>
  !i.isStaple && i.stockTracked !== false;

/** One ingredient line of a recipe, amounts are per single serving. */
export type RecipeLine = {
  ingredientId: string;
  amountPerServing: number;
  unit: Unit;
  optional: boolean;
  /** Lines sharing a non-null group are interchangeable; the lowest sortOrder is the default. */
  altGroup: string | null;
  sortOrder: number;
};

export type Macros = { kcal: number; protein: number };

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Weekly weight change in kg; negative = losing. */
export const GOAL_RATES = [0, -0.25, -0.5, -0.75] as const;
export type GoalRate = (typeof GOAL_RATES)[number];
export const DEFAULT_GOAL_RATE: GoalRate = -0.5;
