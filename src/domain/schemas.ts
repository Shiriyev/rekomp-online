import { z } from 'zod';

import { MEAL_TYPES } from './types';

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
