import { and, asc, desc, eq, gt, gte, isNotNull, isNull, sql } from 'drizzle-orm';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useMemo } from 'react';

import { isSaleActive } from '@/domain/lidl';
import type { PantryStock } from '@/domain/pantry';
import type { LanguagePreference } from '@/domain/language';
import {
  languagePreferenceSchema,
  themePreferenceSchema,
  type ThemePreference,
} from '@/domain/schemas';
import { catalogMacros, recentPresets, type Preset } from '@/domain/today';
import { applyAmounts } from '@/domain/recipeDraft';
import type { Macros } from '@/domain/types';

import { UNSUPPORTED_PRODUCTS_KEY } from './catalog/apply';
import { db } from './client';
import { createLiveStore, makeUseLiveQuery } from './live';
import type { AvailablePortion } from './repositories/portionsRepo';
import {
  COOK_VIEW_KEY,
  COOK_VIEWS,
  LANGUAGE_KEY,
  THEME_KEY,
  type CookView,
} from './repositories/settingsRepo';
import {
  appMeta,
  cookSessions,
  favoriteRecipes,
  ingredients,
  lidlProducts,
  mealLogs,
  pantryItems,
  preparedPortions,
  profile,
  recipeCustomAmounts,
  recipeIngredients,
  recipes,
  recipeSteps,
  shoppingItems,
  weightLogs,
  type CookSession,
  type Ingredient,
  type LidlProduct,
  type MealLog,
  type PantryItem,
  type Profile,
  type Recipe,
  type RecipeIngredient,
  type RecipeStep,
  type ShoppingItem,
} from './schema';

const liveStore = createLiveStore((onChange) => {
  const subscription = addDatabaseChangeListener((event) => onChange(event.tableName));
  return () => subscription.remove();
});
const useLiveQuery = makeUseLiveQuery(liveStore);

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

export function useLanguagePreference(): LanguagePreference {
  const { data } = useLiveQuery(db.select().from(appMeta).where(eq(appMeta.key, LANGUAGE_KEY)));
  const parsed = languagePreferenceSchema.safeParse(data[0]?.value);
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

/** «Моя версия» amounts per recipe: recipeId → { ingredientId: amountPerServing }. */
export function useCustomAmounts(): Map<string, Record<string, number>> {
  const { data } = useLiveQuery(db.select().from(recipeCustomAmounts));
  return useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const row of data) {
      map.set(row.recipeId, { ...map.get(row.recipeId), [row.ingredientId]: row.amountPerServing });
    }
    return map;
  }, [data]);
}

export type RecipeCatalog = { recipes: Recipe[]; macros: Map<string, Macros>; isLoaded: boolean };

/** Recipes with per-serving macros computed from ingredients; reacts to ingredient edits. */
export function useRecipeCatalog(): RecipeCatalog {
  // Archived recipes (left the catalog, still in the history) are not offered.
  const recipeRows = useLiveQuery(
    db.select().from(recipes).where(eq(recipes.isArchived, false)).orderBy(asc(recipes.sortOrder)),
  );
  const lineRows = useLiveQuery(db.select().from(recipeIngredients));
  // Only the nutrition columns: stock bookkeeping on products (last added amount, low-stock
  // threshold) then leaves the rows equal and the catalog maths is not redone.
  const ingredientRows = useLiveQuery(
    db
      .select({
        id: ingredients.id,
        unit: ingredients.unit,
        gramsPerPiece: ingredients.gramsPerPiece,
        kcalPer100g: ingredients.kcalPer100g,
        proteinPer100g: ingredients.proteinPer100g,
        isStaple: ingredients.isStaple,
      })
      .from(ingredients),
  );
  const custom = useCustomAmounts();

  return useMemo(() => {
    const isLoaded = [recipeRows, lineRows, ingredientRows].every((q) => q.updatedAt !== undefined);
    const ingredientMap = new Map(ingredientRows.data.map((i) => [i.id, i]));
    const lines = lineRows.data.map((l) => {
      const amount = custom.get(l.recipeId)?.[l.ingredientId];
      return amount === undefined ? l : { ...l, amountPerServing: amount };
    });
    return {
      recipes: recipeRows.data,
      macros: isLoaded ? catalogMacros(recipeRows.data, lines, ingredientMap) : new Map(),
      isLoaded,
    };
  }, [recipeRows, lineRows, ingredientRows, custom]);
}

/** Pantry as a stock map for domain checks. */
export function usePantryStock(): PantryStock {
  const { data } = useLiveQuery(
    db
      .select({
        ingredientId: pantryItems.ingredientId,
        quantity: pantryItems.quantity,
        unit: pantryItems.unit,
      })
      .from(pantryItems),
  );
  return useMemo(
    () => new Map(data.map((p) => [p.ingredientId, { quantity: p.quantity, unit: p.unit }])),
    [data],
  );
}

export function useIngredientsMap(): Map<string, Ingredient> {
  const { data } = useLiveQuery(db.select().from(ingredients));
  return useMemo(() => new Map(data.map((i) => [i.id, i])), [data]);
}

/** Recipe lines grouped by recipe id («моя версия» applied). */
export function useRecipeLinesByRecipe(): Map<string, RecipeIngredient[]> {
  const { data } = useLiveQuery(
    db.select().from(recipeIngredients).orderBy(asc(recipeIngredients.sortOrder)),
  );
  const custom = useCustomAmounts();
  return useMemo(() => {
    const map = new Map<string, RecipeIngredient[]>();
    for (const raw of data) {
      const amount = custom.get(raw.recipeId)?.[raw.ingredientId];
      const line = amount === undefined ? raw : { ...raw, amountPerServing: amount };
      const bucket = map.get(line.recipeId);
      if (bucket) bucket.push(line);
      else map.set(line.recipeId, [line]);
    }
    return map;
  }, [data, custom]);
}

export type RecipeDetailData = {
  recipe: Recipe | undefined;
  /** With «моя версия» applied: the card's starting point. */
  lines: RecipeIngredient[];
  /** As seeded (the original recipe). */
  originalLines: RecipeIngredient[];
  hasCustom: boolean;
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
  const custom = useLiveQuery(
    db.select().from(recipeCustomAmounts).where(eq(recipeCustomAmounts.recipeId, id)),
    [id],
  );
  const effective = useMemo(
    () =>
      applyAmounts(
        lines.data,
        Object.fromEntries(custom.data.map((c) => [c.ingredientId, c.amountPerServing])),
      ),
    [lines.data, custom.data],
  );
  return {
    recipe: recipe.data[0],
    lines: effective,
    originalLines: lines.data,
    hasCustom: custom.data.length > 0,
    steps: steps.data,
    isLoaded: [recipe, lines, steps, custom].every((q) => q.updatedAt !== undefined),
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

export function usePantryItems(): PantryItem[] {
  return useLiveQuery(db.select().from(pantryItems)).data;
}

export function useShoppingItems(): ShoppingItem[] {
  return useLiveQuery(
    db
      .select()
      .from(shoppingItems)
      .orderBy(asc(shoppingItems.checked), asc(shoppingItems.createdAt)),
  ).data;
}

export function useLidlProducts(): LidlProduct[] {
  return useLiveQuery(db.select().from(lidlProducts).orderBy(asc(lidlProducts.title))).data;
}

export type DayAggregate = { localDate: string; kcal: number; protein: number; entries: number };

/** Totals per local day, newest first. */
export function useDayAggregates(): DayAggregate[] {
  return useLiveQuery(
    db
      .select({
        localDate: mealLogs.localDate,
        kcal: sql<number>`sum(${mealLogs.kcal})`,
        protein: sql<number>`sum(${mealLogs.protein})`,
        entries: sql<number>`count(*)`,
      })
      .from(mealLogs)
      .groupBy(mealLogs.localDate)
      .orderBy(desc(mealLogs.localDate)),
  ).data;
}

export function useWeightLogs(): { localDate: string; weightKg: number }[] {
  return useLiveQuery(db.select().from(weightLogs).orderBy(asc(weightLogs.localDate))).data;
}

export function useLatestLog(): MealLog | undefined {
  return useLiveQuery(db.select().from(mealLogs).orderBy(desc(mealLogs.timestamp)).limit(1))
    .data[0];
}

/** Ids of the saved recipes («Избранное»). */
export function useFavoriteRecipeIds(): ReadonlySet<string> {
  const { data } = useLiveQuery(
    db.select({ recipeId: favoriteRecipes.recipeId }).from(favoriteRecipes),
  );
  return useMemo(() => new Set(data.map((r) => r.recipeId)), [data]);
}

/** Custom products the catalog update could not match (shown once). */
export function useUnsupportedProducts(): string[] {
  const { data } = useLiveQuery(
    db.select().from(appMeta).where(eq(appMeta.key, UNSUPPORTED_PRODUCTS_KEY)),
  );
  return useMemo(() => {
    try {
      const parsed: unknown = data[0] ? JSON.parse(data[0].value) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, [data]);
}

export function useCookView(): CookView {
  const { data } = useLiveQuery(db.select().from(appMeta).where(eq(appMeta.key, COOK_VIEW_KEY)));
  const value = data[0]?.value;
  return COOK_VIEWS.find((v) => v === value) ?? 'steps';
}

export type MealLogDetail = {
  log: MealLog | undefined;
  recipe: Recipe | undefined;
  session: CookSession | undefined;
  isLoaded: boolean;
};

/** One entry with its recipe and cook session, for the history detail screen. */
export function useMealLogDetail(logId: string): MealLogDetail {
  const logQuery = useLiveQuery(db.select().from(mealLogs).where(eq(mealLogs.id, logId)), [logId]);
  const log = logQuery.data[0];
  const recipeId = log?.recipeId ?? '';
  const sessionId = log?.cookSessionId ?? '';
  const recipe = useLiveQuery(db.select().from(recipes).where(eq(recipes.id, recipeId)), [
    recipeId,
  ]);
  const session = useLiveQuery(
    db.select().from(cookSessions).where(eq(cookSessions.id, sessionId)),
    [sessionId],
  );
  return {
    log,
    recipe: recipe.data[0],
    session: session.data[0],
    isLoaded: logQuery.updatedAt !== undefined,
  };
}
