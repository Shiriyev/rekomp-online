import { and, asc, desc, eq, gt, gte, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { isSaleActive } from '@/domain/lidl';
import type { PantryStock } from '@/domain/pantry';
import { themePreferenceSchema, type ThemePreference } from '@/domain/schemas';
import { catalogMacros, recentPresets, type Preset } from '@/domain/today';
import type { Macros } from '@/domain/types';

import { db } from './client';
import type { AvailablePortion } from './repositories/portionsRepo';
import { THEME_KEY } from './repositories/settingsRepo';
import {
  appMeta,
  cookSessions,
  ingredients,
  lidlProducts,
  mealLogs,
  pantryItems,
  preparedPortions,
  profile,
  recipeIngredients,
  recipes,
  recipeSteps,
  type Ingredient,
  type LidlProduct,
  type MealLog,
  type Profile,
  type Recipe,
  type RecipeIngredient,
  type RecipeStep,
} from './schema';

/** Reactive profile row. `isLoaded` is false until the first query resolves. */
export function useProfile(): { profile: Profile | undefined; isLoaded: boolean } {
  const { data, updatedAt } = useLiveQuery(db.select().from(profile).limit(1));
  return { profile: data[0], isLoaded: updatedAt !== undefined };
}

export function useThemePreference(): ThemePreference {
  const { data } = useLiveQuery(db.select().from(appMeta).where(eq(appMeta.key, THEME_KEY)));
  const parsed = themePreferenceSchema.safeParse(data[0]?.value);
  return parsed.success ? parsed.data : 'system';
}

/** All meal log entries of one local day, oldest first. Re-queries when the day changes. */
export function useDayLogs(localDate: string): MealLog[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(mealLogs)
      .where(eq(mealLogs.localDate, localDate))
      .orderBy(asc(mealLogs.timestamp)),
    [localDate],
  );
  return data;
}

export function useAvailablePortions(): AvailablePortion[] {
  const { data } = useLiveQuery(
    db
      .select({ portion: preparedPortions, recipeName: recipes.name })
      .from(preparedPortions)
      .innerJoin(recipes, eq(recipes.id, preparedPortions.recipeId))
      .where(gt(preparedPortions.portionsLeft, 0))
      .orderBy(asc(preparedPortions.cookedAt)),
  );
  return useMemo(() => data.map((r) => ({ ...r.portion, recipeName: r.recipeName })), [data]);
}

export function useRecentPresets(): Preset[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(mealLogs)
      .where(eq(mealLogs.source, 'manual'))
      .orderBy(desc(mealLogs.timestamp))
      .limit(50),
  );
  return useMemo(() => recentPresets(data), [data]);
}

export type RecipeCatalog = { recipes: Recipe[]; macros: Map<string, Macros>; isLoaded: boolean };

/** Recipes with per-serving macros computed from ingredients; reacts to ingredient edits. */
export function useRecipeCatalog(): RecipeCatalog {
  const recipeRows = useLiveQuery(db.select().from(recipes).orderBy(asc(recipes.sortOrder)));
  const lineRows = useLiveQuery(db.select().from(recipeIngredients));
  const ingredientRows = useLiveQuery(db.select().from(ingredients));

  return useMemo(() => {
    const isLoaded = [recipeRows, lineRows, ingredientRows].every((q) => q.updatedAt !== undefined);
    const ingredientMap = new Map(ingredientRows.data.map((i) => [i.id, i]));
    return {
      recipes: recipeRows.data,
      macros: isLoaded ? catalogMacros(recipeRows.data, lineRows.data, ingredientMap) : new Map(),
      isLoaded,
    };
  }, [recipeRows, lineRows, ingredientRows]);
}

/** Pantry as a stock map for domain checks. */
export function usePantryStock(): PantryStock {
  const { data } = useLiveQuery(db.select().from(pantryItems));
  return useMemo(
    () => new Map(data.map((p) => [p.ingredientId, { quantity: p.quantity, unit: p.unit }])),
    [data],
  );
}

export function useIngredientsMap(): Map<string, Ingredient> {
  const { data } = useLiveQuery(db.select().from(ingredients));
  return useMemo(() => new Map(data.map((i) => [i.id, i])), [data]);
}

/** Recipe lines grouped by recipe id. */
export function useRecipeLinesByRecipe(): Map<string, RecipeIngredient[]> {
  const { data } = useLiveQuery(
    db.select().from(recipeIngredients).orderBy(asc(recipeIngredients.sortOrder)),
  );
  return useMemo(() => {
    const map = new Map<string, RecipeIngredient[]>();
    for (const line of data) {
      const bucket = map.get(line.recipeId);
      if (bucket) bucket.push(line);
      else map.set(line.recipeId, [line]);
    }
    return map;
  }, [data]);
}

export type RecipeDetailData = {
  recipe: Recipe | undefined;
  lines: RecipeIngredient[];
  steps: RecipeStep[];
  isLoaded: boolean;
};

export function useRecipeDetail(id: string): RecipeDetailData {
  const recipe = useLiveQuery(db.select().from(recipes).where(eq(recipes.id, id)), [id]);
  const lines = useLiveQuery(
    db
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, id))
      .orderBy(asc(recipeIngredients.sortOrder)),
    [id],
  );
  const steps = useLiveQuery(
    db
      .select()
      .from(recipeSteps)
      .where(eq(recipeSteps.recipeId, id))
      .orderBy(asc(recipeSteps.order)),
    [id],
  );
  return {
    recipe: recipe.data[0],
    lines: lines.data,
    steps: steps.data,
    isLoaded: [recipe, lines, steps].every((q) => q.updatedAt !== undefined),
  };
}

/** Lidl products currently on sale, keyed by ingredient id (expired sales drop out automatically). */
export function useActiveSales(today: string): Map<string, LidlProduct> {
  const { data } = useLiveQuery(
    db.select().from(lidlProducts).where(eq(lidlProducts.onSale, true)),
  );
  return useMemo(
    () => new Map(data.filter((p) => isSaleActive(p, today)).map((p) => [p.ingredientId, p])),
    [data, today],
  );
}

export type ActiveCook = { id: string; recipeId: string; recipeName: string } | undefined;

/** Unfinished cooking session to offer «Продолжить готовку». */
export function useActiveCook(): ActiveCook {
  const { data } = useLiveQuery(
    db
      .select({ id: cookSessions.id, recipeId: cookSessions.recipeId, recipeName: recipes.name })
      .from(cookSessions)
      .innerJoin(recipes, eq(recipes.id, cookSessions.recipeId))
      .where(and(isNull(cookSessions.finishedAt), isNull(cookSessions.abandonedAt)))
      .orderBy(desc(cookSessions.startedAt))
      .limit(1),
  );
  return data[0];
}

/** Whether a recipe has never been cooked to the end (for the first-cook badge). */
export function useIsFirstCook(recipeId: string): boolean {
  const { data } = useLiveQuery(
    db
      .select({ id: cookSessions.id })
      .from(cookSessions)
      .where(
        and(
          eq(cookSessions.recipeId, recipeId),
          isNotNull(cookSessions.finishedAt),
          isNull(cookSessions.undoneAt),
        ),
      )
      .limit(1),
    [recipeId],
  );
  return data.length === 0;
}

/** Protein per local day since `fromDate` (inclusive), for the streak. */
export function useDailyProtein(fromDate: string): Map<string, number> {
  const { data } = useLiveQuery(
    db
      .select({ localDate: mealLogs.localDate, protein: mealLogs.protein })
      .from(mealLogs)
      .where(gte(mealLogs.localDate, fromDate)),
    [fromDate],
  );
  return useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data) map.set(row.localDate, (map.get(row.localDate) ?? 0) + row.protein);
    return map;
  }, [data]);
}
