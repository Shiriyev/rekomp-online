import { asc, eq } from 'drizzle-orm';

import {
  customIngredientSchema,
  ingredientNutritionSchema,
  ingredientSettingsSchema,
  type CustomIngredientInput,
  type IngredientNutritionInput,
  type IngredientSettingsInput,
} from '../../domain/schemas';
import { newId } from '../../lib/id';
import { ingredients, type Ingredient } from '../schema';
import type { AppDb } from '../types';

type NutritionValues = {
  kcalPer100g?: number;
  proteinPer100g?: number;
  gramsPerPiece?: number | null;
};

/**
 * Marks a catalog product whose nutrition the user changed: later catalog updates keep the
 * user's numbers instead of overwriting them.
 */
function editedFlag(current: Ingredient | undefined, next: NutritionValues) {
  if (!current) return {};
  const changed =
    (next.kcalPer100g !== undefined && next.kcalPer100g !== current.kcalPer100g) ||
    (next.proteinPer100g !== undefined && next.proteinPer100g !== current.proteinPer100g) ||
    (next.gramsPerPiece !== undefined && next.gramsPerPiece !== current.gramsPerPiece);
  return changed ? { nutritionEdited: true } : {};
}

export function createIngredientsRepo(db: AppDb) {
  return {
    list(): Ingredient[] {
      return db
        .select()
        .from(ingredients)
        .orderBy(asc(ingredients.category), asc(ingredients.name))
        .all();
    },

    getById(id: string): Ingredient | undefined {
      return db.select().from(ingredients).where(eq(ingredients.id, id)).get();
    },

    /** All ingredients keyed by id, the shape domain functions expect. */
    mapById(): Map<string, Ingredient> {
      return new Map(this.list().map((i) => [i.id, i]));
    },

    updateNutrition(id: string, input: IngredientNutritionInput): void {
      const values = ingredientNutritionSchema.parse(input);
      const result = db
        .update(ingredients)
        .set({ ...values, ...editedFlag(this.getById(id), values) })
        .where(eq(ingredients.id, id))
        .returning({ id: ingredients.id })
        .all();
      if (result.length === 0) throw new Error(`Ingredient not found: ${id}`);
    },

    /** Nutrition, grams per piece and the low-stock threshold. */
    updateSettings(id: string, input: IngredientSettingsInput): void {
      const values = ingredientSettingsSchema.parse(input);
      const result = db
        .update(ingredients)
        .set({ ...values, ...editedFlag(this.getById(id), values) })
        .where(eq(ingredients.id, id))
        .returning({ id: ingredients.id })
        .all();
      if (result.length === 0) throw new Error(`Ingredient not found: ${id}`);
    },

    createCustom(input: CustomIngredientInput): Ingredient {
      const values = customIngredientSchema.parse(input);
      return db
        .insert(ingredients)
        .values({
          id: `custom_${newId()}`,
          ...values,
          gramsPerPiece: values.unit === 'pcs' ? values.gramsPerPiece : null,
          isStaple: false,
          isCustom: true,
        })
        .returning()
        .get();
    },
  };
}

export type IngredientsRepo = ReturnType<typeof createIngredientsRepo>;
