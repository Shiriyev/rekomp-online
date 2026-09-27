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
        .set(values)
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
        .set(values)
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
