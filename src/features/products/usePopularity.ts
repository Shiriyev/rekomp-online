import { useMemo } from 'react';

import { useRecipeLinesByRecipe } from '@/db/hooks';

/** How many recipes use each product («Чаще нужны», «Есть в рецептах»). */
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
