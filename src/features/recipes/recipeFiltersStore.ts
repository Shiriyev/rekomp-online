import { create } from 'zustand';

import type { RecipeFilter } from '@/domain/browse';

type FiltersState = {
  /** Quick filters on the recipe pages; shared by the shelves and the «Все» grids. */
  active: readonly RecipeFilter[];
  toggle: (filter: RecipeFilter) => void;
  clear: () => void;
};

export const useRecipeFilters = create<FiltersState>((set) => ({
  active: [],
  toggle: (filter) =>
    set((s) => ({
      active: s.active.includes(filter)
        ? s.active.filter((f) => f !== filter)
        : [...s.active, filter],
    })),
  clear: () => set({ active: [] }),
}));
