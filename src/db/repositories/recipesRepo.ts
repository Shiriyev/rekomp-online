import { and, asc, eq, inArray } from 'drizzle-orm';

import { sanitizeAmounts } from '../../domain/recipeDraft';
import { customRecipeSchema, photoUriSchema, type CustomRecipeInput } from '../../domain/schemas';
import type { MealType } from '../../domain/types';
import {
  favoriteRecipes,
  hiddenRecipes,
  recipeCustomAmounts,
  recipeIngredients,
  recipes,
  recipeSteps,
  type Recipe,
  type RecipeIngredient,
  type RecipeStep,
} from '../schema';
import { newId } from '../../lib/id';
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

    /**
     * «Сохранить как мою версию»: per-serving amounts that become this recipe's defaults.
     * Values equal to the original are not stored; the original lines are never changed.
     */
    saveCustomAmounts(recipeId: string, amounts: Readonly<Record<string, number>>): number {
      return db.transaction((tx) => {
        const lines = tx
          .select()
          .from(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, recipeId))
          .all();
        if (lines.length === 0) throw new Error(`Recipe not found: ${recipeId}`);
        const clean = sanitizeAmounts(amounts, lines);
        const base = new Map(lines.map((l) => [l.ingredientId, l.amountPerServing]));
        const rows = Object.entries(clean)
          .filter(([id, amount]) => Math.abs(amount - (base.get(id) ?? amount)) > 1e-9)
          .map(([ingredientId, amountPerServing]) => ({
            recipeId,
            ingredientId,
            amountPerServing,
          }));
        tx.delete(recipeCustomAmounts).where(eq(recipeCustomAmounts.recipeId, recipeId)).run();
        if (rows.length > 0) tx.insert(recipeCustomAmounts).values(rows).run();
        return rows.length;
      });
    },

    /** Sets or clears the dish's own photo; returns the previous one (to delete its file). */
    setPhoto(recipeId: string, photoUri: string | null): string | null {
      const uri = photoUriSchema.parse(photoUri);
      return db.transaction((tx) => {
        const current = tx.select().from(recipes).where(eq(recipes.id, recipeId)).get();
        if (!current) throw new Error(`Recipe not found: ${recipeId}`);
        tx.update(recipes).set({ photoUri: uri }).where(eq(recipes.id, recipeId)).run();
        return current.photoUri;
      });
    },

    /** Saves or un-saves a recipe («Избранное»); returns whether it is saved now. */
    toggleFavorite(recipeId: string, now: number = Date.now()): boolean {
      return db.transaction((tx) => {
        const saved = tx
          .select()
          .from(favoriteRecipes)
          .where(eq(favoriteRecipes.recipeId, recipeId))
          .get();
        if (saved) {
          tx.delete(favoriteRecipes).where(eq(favoriteRecipes.recipeId, recipeId)).run();
          return false;
        }
        tx.insert(favoriteRecipes).values({ recipeId, createdAt: now }).run();
        return true;
      });
    },

    /** «Скрыть это блюдо»: out of every list and filter until shown again. Idempotent. */
    hide(recipeId: string, now: number = Date.now()): void {
      db.insert(hiddenRecipes).values({ recipeId, hiddenAt: now }).onConflictDoNothing().run();
    },

    /** Back into the lists (from the profile's hidden list or Undo). */
    unhide(recipeId: string): void {
      db.delete(hiddenRecipes).where(eq(hiddenRecipes.recipeId, recipeId)).run();
    },

    /** Back to the original recipe amounts. */
    resetCustomAmounts(recipeId: string): void {
      db.delete(recipeCustomAmounts).where(eq(recipeCustomAmounts.recipeId, recipeId)).run();
    },

    /**
     * A dish the user wrote, saved alongside the catalog ones so it shows on its meal
     * page and can be cooked like any other. `isCustom` keeps the catalog update from
     * treating it as a row that went missing.
     */
    createCustom(input: CustomRecipeInput): Recipe {
      const v = customRecipeSchema.parse(input);
      return db.transaction((tx) => {
        const id = `own_${newId()}`;
        const recipe = tx
          .insert(recipes)
          .values({
            id,
            name: v.name,
            mealType: v.mealType,
            mealTypes: [v.mealType],
            defaultServings: v.defaultServings,
            totalMinutes: v.totalMinutes,
            photoUri: v.photoUri,
            ingredientCount: v.lines.length,
            source: 'own',
            isCustom: true,
            // The user's own dish sorts before the catalog, which starts at 0.
            sortOrder: -1,
          })
          .returning()
          .get();
        tx.insert(recipeIngredients)
          .values(
            v.lines.map((l, sortOrder) => ({
              recipeId: id,
              ingredientId: l.ingredientId,
              amountPerServing: l.amountPerServing,
              unit: l.unit,
              sortOrder,
            })),
          )
          .run();
        if (v.steps.length > 0) {
          tx.insert(recipeSteps)
            .values(v.steps.map((text, i) => ({ recipeId: id, order: i + 1, text })))
            .run();
        }
        return recipe;
      });
    },

    /** Removes a dish the user wrote, with its lines and steps. */
    removeCustom(recipeId: string): void {
      db.delete(recipes)
        .where(and(eq(recipes.id, recipeId), eq(recipes.isCustom, true)))
        .run();
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
