import { useMemo } from 'react';

import {
  useFavoriteRecipeIds,
  useIngredientsMap,
  usePantryStock,
  useRecipeCatalog,
  useRecipeLinesByRecipe,
} from '@/db/hooks';
import type { Recipe } from '@/db/schema';
import { applyRecipeFilters, type BrowseRecipe } from '@/domain/browse';
import { recipeMacros } from '@/domain/nutrition';
import { canCook, type CookCheck } from '@/domain/pantry';
import { applyAmounts } from '@/domain/recipeDraft';
import { recipeMeals } from '@/domain/recipes';
import { searchIngredients } from '@/domain/search';
import type { MealType } from '@/domain/types';
import { useContent } from '@/i18n/content';

import { useRecipeDraftStore } from './recipeDraftStore';
import { useRecipeFilters } from './recipeFiltersStore';

export type BrowseItem = BrowseRecipe & { recipe: Recipe; check: CookCheck };

/**
 * Recipes of one meal, ready for shelves and grids: macros (card drafts included), what is
 * missing at home, and the active quick filters and search applied.
 */
export function useBrowseRecipes(
  meal: MealType | null,
  query = '',
): { items: BrowseItem[]; isLoaded: boolean } {
  const catalog = useRecipeCatalog();
  const linesByRecipe = useRecipeLinesByRecipe();
  const ingredients = useIngredientsMap();
  const pantry = usePantryStock();
  const drafts = useRecipeDraftStore((s) => s.drafts);
  const active = useRecipeFilters((s) => s.active);
  const proteins = useRecipeFilters((s) => s.proteins);
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

  const items = useMemo(() => {
    const filtered = applyRecipeFilters(all, new Set(active), new Set(proteins));
    if (!query.trim()) return filtered;
    // Same accent/case-insensitive search as products, over Russian and English names.
    const named = filtered.map((i) => ({
      ...i,
      name: i.recipe.name,
      nameHu: null,
      aliases: [content.recipeName(i.recipe)],
    }));
    return searchIngredients(named, query);
  }, [all, active, proteins, query, content]);

  return { items, isLoaded };
}
