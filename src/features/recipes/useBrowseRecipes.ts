import { useMemo } from 'react';

import {
  useDayLogs,
  useFavoriteRecipeIds,
  useIngredientsMap,
  usePantryStock,
  useProfile,
  useRecipeCatalog,
  useRecipeLinesByRecipe,
} from '@/db/hooks';
import type { Recipe } from '@/db/schema';
import { applyRecipeFilters, type BrowseRecipe } from '@/domain/browse';
import { recipeMacros } from '@/domain/nutrition';
import { canCook, type CookCheck } from '@/domain/pantry';
import { applyAmounts } from '@/domain/recipeDraft';
import { recipeMeals, sortRecipes, type DayLeft } from '@/domain/recipes';
import { createSearchIndex } from '@/domain/search';
import { summarizeDay } from '@/domain/today';
import type { MealType } from '@/domain/types';
import { useContent } from '@/i18n/content';
import { useClock } from '@/lib/useClock';

import { useRecipeDraftStore } from './recipeDraftStore';
import { useRecipeFilters, useRecipeFilterState } from './recipeFiltersStore';

export type BrowseItem = BrowseRecipe & { recipe: Recipe; check: CookCheck };

/** What is left of today's kcal and protein targets, for «Подходит под остаток дня». */
export function useDayLeft(): DayLeft | undefined {
  const { today } = useClock();
  const { profile } = useProfile();
  const logs = useDayLogs(today);
  return useMemo(() => {
    if (!profile) return undefined;
    const { total } = summarizeDay(logs);
    return {
      kcal: profile.kcalTarget - total.kcal,
      protein: profile.proteinTargetG - total.protein,
    };
  }, [profile, logs]);
}

/**
 * Recipes of one meal, ready for shelves and grids: macros (card drafts included), what is
 * missing at home, the filters, and the search over names and ingredient names («курица»
 * finds every dish with chicken). `sortList` applies the chosen sort to any list (shelves
 * keep their own order without one); `all` is before filters (for the cuisine chips).
 */
export function useBrowseRecipes(meal: MealType | null, query = '') {
  const catalog = useRecipeCatalog();
  const linesByRecipe = useRecipeLinesByRecipe();
  const ingredients = useIngredientsMap();
  const pantry = usePantryStock();
  const drafts = useRecipeDraftStore((s) => s.drafts);
  const filters = useRecipeFilterState();
  const sort = useRecipeFilters((s) => s.sort);
  const left = useDayLeft();
  const favorites = useFavoriteRecipeIds();
  const content = useContent();
  const isLoaded = catalog.isLoaded && ingredients.size > 0;

  // Macros and stock checks: only redone when recipes, stock or drafts change.
  const all = useMemo<BrowseItem[]>(() => {
    if (!meal || !isLoaded) return [];
    return catalog.recipes
      .filter((r) => recipeMeals(r).includes(meal))
      .map((recipe) => {
        const draft = drafts[recipe.id];
        const lines = linesByRecipe.get(recipe.id) ?? [];
        const drafted = draft ? applyAmounts(lines, draft) : lines;
        const check = canCook(drafted, ingredients, pantry, recipe.defaultServings);
        return {
          id: recipe.id,
          sortOrder: recipe.sortOrder,
          totalMinutes: recipe.totalMinutes,
          ingredientCount: recipe.ingredientCount || lines.length,
          isBatch: recipe.isBatch,
          equipment: recipe.equipment,
          tags: recipe.tags,
          mainProtein: recipe.mainProtein,
          cuisine: recipe.cuisine,
          source: recipe.source,
          macros: draft
            ? recipeMacros(drafted, ingredients).perServing
            : (catalog.macros.get(recipe.id) ?? { kcal: 0, protein: 0 }),
          missing: check.missing.length,
          favorite: favorites.has(recipe.id),
          recipe,
          check,
        };
      });
  }, [meal, isLoaded, catalog, linesByRecipe, drafts, ingredients, pantry, favorites]);

  // Names in both languages and every product of the recipe; rebuilt with the list only.
  const index = useMemo(
    () =>
      createSearchIndex(all, (i) => [
        i.recipe.name,
        i.recipe.nameEn,
        content.recipeName(i.recipe),
        ...i.check.lines.flatMap((l) => {
          const ing = ingredients.get(l.line.ingredientId);
          return ing ? [ing.name, ing.nameHu, ...content.searchAliases(ing)] : [];
        }),
      ]),
    [all, ingredients, content],
  );

  const sortList = useMemo(
    () =>
      <T extends BrowseItem>(list: T[]): T[] =>
        sort ? sortRecipes(list, sort, left) : list,
    [sort, left],
  );

  const items = useMemo(() => {
    const found = query.trim() ? index.search(query).items : all;
    return sortList(applyRecipeFilters(found, filters));
  }, [all, index, query, filters, sortList]);

  return { items, all, isLoaded, sort, sortList };
}
