import { create } from 'zustand';

import type { RecipeFilter } from '@/domain/browse';

type FiltersState = {
  /** Quick filters on the recipe pages; shared by the shelves and the «Все» grids. */
  active: readonly RecipeFilter[];
  /** Main ingredients to keep («Курица», «Рыба»); empty = all. */
  proteins: readonly string[];
  toggle: (filter: RecipeFilter) => void;
  toggleProtein: (protein: string) => void;
  clear: () => void;
};

const flip = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export const useRecipeFilters = create<FiltersState>((set) => ({
  active: [],
  proteins: [],
  toggle: (filter) => set((s) => ({ active: flip(s.active, filter) })),
  toggleProtein: (protein) => set((s) => ({ proteins: flip(s.proteins, protein) })),
  clear: () => set({ active: [], proteins: [] }),
}));

/** How many filters are on (for the «Фильтры · 3» button). */
export const useActiveFilterCount = () =>
  useRecipeFilters((s) => s.active.length + s.proteins.length);
