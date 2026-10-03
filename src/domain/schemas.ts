import { z } from 'zod';

import {
  ACTIVITY_LEVELS,
  GOAL_RATES,
  INGREDIENT_CATEGORIES,
  MEAL_TYPES,
  SEXES,
  UNITS,
} from './types';
import { LANGUAGE_PREFERENCES } from './language';

/** Stored meal photo (file:// URI inside the app's documents). */
export const photoUriSchema = z.string().min(1).max(2048).nullable();

/** A product eaten with a manual entry, in the ingredient's unit. */
export const deductionItemSchema = z.object({
  ingredientId: z.string().min(1),
  amount: z.number().positive().max(100_000),
});

/** Manual food entry ("купил сникерс"). */
export const manualLogInputSchema = z.object({
  /** Client-generated idempotency key: saving the same form twice creates one entry. */
  id: z.string().min(8).max(64).optional(),
  name: z.string().trim().min(1, 'validation.required').max(80, 'validation.maxLength|80'),
  kcal: z.number().int('validation.integer').min(0).max(5000),
  protein: z.number().min(0).max(500),
  mealType: z.enum(MEAL_TYPES),
  photoUri: photoUriSchema.optional(),
  /** Optional: products taken from «Дома» in the same transaction. */
  deductions: z.array(deductionItemSchema).max(30).optional(),
});
export type ManualLogInput = z.infer<typeof manualLogInputSchema>;

export const ingredientNutritionSchema = z.object({
  kcalPer100g: z.number().min(0).max(900),
  proteinPer100g: z.number().min(0).max(100),
  gramsPerPiece: z.number().positive().max(5000).nullable(),
});
export type IngredientNutritionInput = z.infer<typeof ingredientNutritionSchema>;

export const pantryQuantitySchema = z.number().finite().min(0).max(1_000_000);

/** Parses user-typed decimals, accepting a comma separator ("82,5"). Returns NaN when invalid. */
export function parseDecimal(input: string): number {
  const normalized = input.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export const PROFILE_LIMITS = {
  age: { min: 16, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 300 },
  kcalTarget: { min: 1000, max: 5000 },
  proteinG: { min: 30, max: 400 },
} as const;

export const profileSchema = z
  .object({
    sex: z.enum(SEXES),
    age: z.number().int().min(PROFILE_LIMITS.age.min).max(PROFILE_LIMITS.age.max),
    heightCm: z.number().min(PROFILE_LIMITS.heightCm.min).max(PROFILE_LIMITS.heightCm.max),
    weightKg: z.number().min(PROFILE_LIMITS.weightKg.min).max(PROFILE_LIMITS.weightKg.max),
    activityLevel: z.enum(ACTIVITY_LEVELS),
    goalRateKgPerWeek: z.literal(GOAL_RATES),
    kcalTarget: z
      .number()
      .int()
      .min(PROFILE_LIMITS.kcalTarget.min)
      .max(PROFILE_LIMITS.kcalTarget.max),
    proteinTargetG: z
      .number()
      .int()
      .min(PROFILE_LIMITS.proteinG.min)
      .max(PROFILE_LIMITS.proteinG.max),
    proteinMinG: z.number().int().min(PROFILE_LIMITS.proteinG.min).max(PROFILE_LIMITS.proteinG.max),
    targetOverridden: z.boolean(),
  })
  .refine((p) => p.proteinMinG <= p.proteinTargetG, {
    path: ['proteinMinG'],
    message: 'validation.minAboveTarget',
  });
export type ProfileInput = z.infer<typeof profileSchema>;

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const themePreferenceSchema = z.enum(THEME_PREFERENCES);

export const languagePreferenceSchema = z.enum(LANGUAGE_PREFERENCES);

export const customIngredientSchema = z
  .object({
    name: z.string().trim().min(1, 'validation.required').max(60, 'validation.maxLength|60'),
    category: z.enum(INGREDIENT_CATEGORIES),
    unit: z.enum(UNITS),
    gramsPerPiece: z.number().positive().max(5000).nullable(),
    kcalPer100g: z.number().min(0).max(900),
    proteinPer100g: z.number().min(0).max(100),
  })
  .refine((v) => v.unit !== 'pcs' || v.gramsPerPiece !== null, {
    path: ['gramsPerPiece'],
    message: 'validation.pieceWeight',
  });
export type CustomIngredientInput = z.infer<typeof customIngredientSchema>;

export const ingredientSettingsSchema = ingredientNutritionSchema.extend({
  lowStockThreshold: z.number().min(0).max(100_000).nullable(),
});
export type IngredientSettingsInput = z.infer<typeof ingredientSettingsSchema>;

export const shoppingItemInputSchema = z
  .object({
    title: z.string().trim().min(1, 'validation.required').max(80),
    ingredientId: z.string().min(1).nullable(),
    quantity: z.number().positive().max(100_000).nullable(),
    unit: z.enum(UNITS).nullable(),
  })
  .refine((v) => (v.quantity === null) === (v.unit === null), {
    path: ['quantity'],
    message: 'validation.quantityWithUnit',
  });
export type ShoppingItemInput = z.infer<typeof shoppingItemInputSchema>;

export const mealLogEditSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(80, 'validation.maxLength|80'),
  kcal: z.number().int('validation.integer').min(0).max(5000),
  protein: z.number().min(0).max(500),
  mealType: z.enum(MEAL_TYPES),
  /** New time (UTC ms); the entry may move to another logical day. */
  timestamp: z.number().int().positive().optional(),
});
export type MealLogEditInput = z.infer<typeof mealLogEditSchema>;
