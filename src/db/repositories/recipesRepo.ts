import { asc, eq, inArray } from 'drizzle-orm';

import type { MealType } from '../../domain/types';
import {
  recipeIngredients,
  recipes,
  recipeSteps,
  type Recipe,
  type RecipeIngredient,
  type RecipeStep,
} from '../schema';
import type { AppDb } from '../types';

export type RecipeDetail = { recipe: Recipe; lines: RecipeIngredient[]; steps: RecipeStep[] };

const groupBy = <T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> => {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
};

export function createRecipesRepo(db: AppDb) {
  const withDetails = (list: Recipe[]): RecipeDetail[] => {
    if (list.length === 0) return [];
    const ids = list.map((r) => r.id);
    const lines = groupBy(
      db
        .select()
        .from(recipeIngredients)
        .where(inArray(recipeIngredients.recipeId, ids))
        .orderBy(asc(recipeIngredients.sortOrder))
        .all(),
      (l) => l.recipeId,
    );
    const steps = groupBy(
      db
        .select()
        .from(recipeSteps)
        .where(inArray(recipeSteps.recipeId, ids))
        .orderBy(asc(recipeSteps.order))
        .all(),
      (s) => s.recipeId,
    );
    return list.map((recipe) => ({
      recipe,
      lines: lines.get(recipe.id) ?? [],
      steps: steps.get(recipe.id) ?? [],
    }));
  };

  return {
    listByMealType(mealType: MealType): Recipe[] {
      return db
        .select()
        .from(recipes)
        .where(eq(recipes.mealType, mealType))
        .orderBy(asc(recipes.sortOrder))
        .all();
    },

    getDetail(id: string): RecipeDetail | undefined {
      const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
      return recipe ? withDetails([recipe])[0] : undefined;
    },

    /** Every recipe with its lines and steps, in 3 queries. */
    listDetails(mealType?: MealType): RecipeDetail[] {
      const query = db.select().from(recipes);
      const list = (mealType ? query.where(eq(recipes.mealType, mealType)) : query)
        .orderBy(asc(recipes.sortOrder))
        .all();
      return withDetails(list);
    },
  };
}

export type RecipesRepo = ReturnType<typeof createRecipesRepo>;
