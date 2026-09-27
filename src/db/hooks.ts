import { asc, desc, eq, gt } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { themePreferenceSchema, type ThemePreference } from '@/domain/schemas';
import { catalogMacros, recentPresets, type Preset } from '@/domain/today';
import type { Macros } from '@/domain/types';

import { db } from './client';
import type { AvailablePortion } from './repositories/portionsRepo';
import { THEME_KEY } from './repositories/settingsRepo';
import {
  appMeta,
  ingredients,
  mealLogs,
  preparedPortions,
  profile,
  recipeIngredients,
  recipes,
  type MealLog,
  type Profile,
  type Recipe,
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
