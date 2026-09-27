import { z } from 'zod';

import {
  ACTIVITY_LEVELS,
  GOAL_RATES,
  INGREDIENT_CATEGORIES,
  MEAL_TYPES,
  SEXES,
  UNITS,
} from './types';

/** Manual food entry ("купил сникерс"). */
export const manualLogInputSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(80, 'Не длиннее 80 символов'),
  kcal: z.number().int('Целое число').min(0).max(5000),
  protein: z.number().min(0).max(500),
  mealType: z.enum(MEAL_TYPES),
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
    message: 'Минимум не может быть больше цели',
  });
export type ProfileInput = z.infer<typeof profileSchema>;

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const themePreferenceSchema = z.enum(THEME_PREFERENCES);

export const customIngredientSchema = z
  .object({
    name: z.string().trim().min(1, 'Введите название').max(60, 'Не длиннее 60 символов'),
    category: z.enum(INGREDIENT_CATEGORIES),
    unit: z.enum(UNITS),
    gramsPerPiece: z.number().positive().max(5000).nullable(),
    kcalPer100g: z.number().min(0).max(900),
    proteinPer100g: z.number().min(0).max(100),
  })
  .refine((v) => v.unit !== 'pcs' || v.gramsPerPiece !== null, {
    path: ['gramsPerPiece'],
    message: 'Укажите вес одной штуки',
  });
export type CustomIngredientInput = z.infer<typeof customIngredientSchema>;

export const ingredientSettingsSchema = ingredientNutritionSchema.extend({
  lowStockThreshold: z.number().min(0).max(100_000).nullable(),
});
export type IngredientSettingsInput = z.infer<typeof ingredientSettingsSchema>;

const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД');

export const lidlProductSchema = z
  .object({
    ingredientId: z.string().min(1, 'Выберите продукт'),
    title: z.string().trim().min(1, 'Введите название').max(80),
    packageSize: z.number().positive('Больше нуля').max(100_000),
    packageUnit: z.enum(UNITS),
    priceHuf: z.number().int().min(0).max(1_000_000).nullable(),
    onSale: z.boolean(),
    saleUntil: localDateSchema.nullable(),
    barcode: z
      .string()
      .trim()
      .regex(/^\d{8,14}$/, '8–14 цифр')
      .nullable(),
    notes: z.string().trim().max(200).nullable(),
  })
  .transform((v) => (v.onSale ? v : { ...v, saleUntil: null }));
export type LidlProductInput = z.input<typeof lidlProductSchema>;

export const shoppingItemInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Введите название').max(80),
    ingredientId: z.string().min(1).nullable(),
    quantity: z.number().positive().max(100_000).nullable(),
    unit: z.enum(UNITS).nullable(),
  })
  .refine((v) => (v.quantity === null) === (v.unit === null), {
    path: ['quantity'],
    message: 'Количество и единица указываются вместе',
  });
export type ShoppingItemInput = z.infer<typeof shoppingItemInputSchema>;

export const mealLogEditSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(80, 'Не длиннее 80 символов'),
  kcal: z.number().int('Целое число').min(0).max(5000),
  protein: z.number().min(0).max(500),
  mealType: z.enum(MEAL_TYPES),
});
export type MealLogEditInput = z.infer<typeof mealLogEditSchema>;
