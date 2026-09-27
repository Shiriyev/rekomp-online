import { asc, eq } from 'drizzle-orm';

import { ingredientNutritionSchema, type IngredientNutritionInput } from '../../domain/schemas';
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
  };
}

export type IngredientsRepo = ReturnType<typeof createIngredientsRepo>;
