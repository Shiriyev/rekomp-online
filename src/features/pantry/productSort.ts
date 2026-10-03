import { useMemo } from 'react';
import { create } from 'zustand';

import { useRecipeLinesByRecipe } from '@/db/hooks';
import { INGREDIENT_CATEGORIES, type IngredientCategory } from '@/domain/types';
import { compareNames } from '@/lib/collate';

/** «Чаще нужны»: products the most recipes use first; «По алфавиту»: by category, then name. */
export const PRODUCT_SORTS = ['popular', 'alpha'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** One choice for «Дома» and «Добавить домой», kept while the app runs. */
export const useProductSort = create<{ sort: ProductSort; set: (sort: ProductSort) => void }>(
  (set) => ({ sort: 'popular', set: (sort) => set({ sort }) }),
);

/** How many recipes use each product. */
export function useProductPopularity(): ReadonlyMap<string, number> {
  const linesByRecipe = useRecipeLinesByRecipe();
  return useMemo(() => {
    const uses = new Map<string, number>();
    for (const lines of linesByRecipe.values()) {
      for (const id of new Set(lines.map((l) => l.ingredientId)))
        uses.set(id, (uses.get(id) ?? 0) + 1);
    }
    return uses;
  }, [linesByRecipe]);
}

const CATEGORY_ORDER = new Map(INGREDIENT_CATEGORIES.map((c, i) => [c, i]));

/** Sorts products for display; `name` is the name in the UI language. */
export function sortProducts<T>(
  items: readonly T[],
  sort: ProductSort,
  key: (item: T) => { id: string; category: IngredientCategory; name: string },
  popularity: ReadonlyMap<string, number>,
): T[] {
  return [...items].sort((x, y) => {
    const a = key(x);
    const b = key(y);
    if (sort === 'popular') {
      const diff = (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0);
      if (diff !== 0) return diff;
    } else {
      const diff = (CATEGORY_ORDER.get(a.category) ?? 0) - (CATEGORY_ORDER.get(b.category) ?? 0);
      if (diff !== 0) return diff;
    }
    return compareNames(a.name, b.name);
  });
}
