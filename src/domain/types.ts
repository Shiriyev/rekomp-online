/** Shared domain vocabulary. Pure types and constants: no React, no DB. */

export const UNITS = ['g', 'ml', 'pcs'] as const;
export type Unit = (typeof UNITS)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const INGREDIENT_CATEGORIES = [
  'dairy',
  'meat',
  'grains',
  'vegetables',
  'fruits',
  'eggs',
  'bread',
  'canned',
  'oil',
  'spices',
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

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
};

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
