import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  KCAL_RANGE_IDS,
  MAX_INGREDIENTS,
  MAX_MINUTES,
  MIN_DENSITY,
  MIN_PROTEIN,
  NO_RECIPE_FILTERS,
  RECIPE_FILTERS,
  RECIPE_SOURCES,
  countRecipeFilters,
  type RecipeFilter,
  type RecipeFilterState,
} from '@/domain/browse';
import { RECIPE_SORTS, type RecipeSort } from '@/domain/recipes';
import { persistStorage } from '@/lib/persistStorage';

type FiltersState = RecipeFilterState & {
  /** null: every shelf keeps its own order. */
  sort: RecipeSort | null;
  toggle: (filter: RecipeFilter) => void;
  toggleProtein: (protein: string) => void;
  toggleCuisine: (cuisine: string) => void;
  /** Single-pick groups: picking the current value again clears it. */
  pick: <K extends PickKey>(key: K, value: RecipeFilterState[K]) => void;
  setSort: (sort: RecipeSort | null) => void;
  /** «Сбросить»: every filter off; the sort stays. */
  clear: () => void;
};
type PickKey = 'kcal' | 'minProtein' | 'minDensity' | 'maxMinutes' | 'maxIngredients' | 'source';

const flip = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

const oneOf = <T>(list: readonly T[], v: unknown): T | null =>
  list.includes(v as T) ? (v as T) : null;
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Filters on the recipe pages, shared by the shelves and the «Все» grids; remembered. */
export const useRecipeFilters = create<FiltersState>()(
  persist(
    (set) => ({
      ...NO_RECIPE_FILTERS,
      sort: null,
      toggle: (filter) => set((s) => ({ toggles: flip(s.toggles, filter) })),
      toggleProtein: (protein) => set((s) => ({ proteins: flip(s.proteins, protein) })),
      toggleCuisine: (cuisine) => set((s) => ({ cuisines: flip(s.cuisines, cuisine) })),
      pick: (key, value) =>
        set((s) => ({ [key]: s[key] === value ? null : value }) as Partial<FiltersState>),
      setSort: (sort) => set({ sort }),
      clear: () => set({ ...NO_RECIPE_FILTERS }),
    }),
    {
      name: 'recipe-filters',
      version: 1,
      storage: persistStorage,
      partialize: ({ toggle, toggleProtein, toggleCuisine, pick, setSort, clear, ...data }) => data,
      // A saved value that no longer exists is dropped.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FiltersState>;
        return {
          ...current,
          toggles: strings(p.toggles).filter(
            (x): x is RecipeFilter => oneOf(RECIPE_FILTERS, x) !== null,
          ),
          proteins: strings(p.proteins),
          cuisines: strings(p.cuisines),
          kcal: oneOf(KCAL_RANGE_IDS, p.kcal),
          minProtein: oneOf(MIN_PROTEIN, p.minProtein),
          minDensity: oneOf(MIN_DENSITY, p.minDensity),
          maxMinutes: oneOf(MAX_MINUTES, p.maxMinutes),
          maxIngredients: oneOf(MAX_INGREDIENTS, p.maxIngredients),
          source: oneOf(RECIPE_SOURCES, p.source),
          sort: oneOf(RECIPE_SORTS, p.sort),
        };
      },
    },
  ),
);

/** The filter part of the store (for `applyRecipeFilters`), stable while it is unchanged. */
export function useRecipeFilterState(): RecipeFilterState {
  const toggles = useRecipeFilters((s) => s.toggles);
  const proteins = useRecipeFilters((s) => s.proteins);
  const cuisines = useRecipeFilters((s) => s.cuisines);
  const kcal = useRecipeFilters((s) => s.kcal);
  const minProtein = useRecipeFilters((s) => s.minProtein);
  const minDensity = useRecipeFilters((s) => s.minDensity);
  const maxMinutes = useRecipeFilters((s) => s.maxMinutes);
  const maxIngredients = useRecipeFilters((s) => s.maxIngredients);
  const source = useRecipeFilters((s) => s.source);
  return useMemo(
    () => ({
      toggles,
      proteins,
      cuisines,
      kcal,
      minProtein,
      minDensity,
      maxMinutes,
      maxIngredients,
      source,
    }),
    [toggles, proteins, cuisines, kcal, minProtein, minDensity, maxMinutes, maxIngredients, source],
  );
}

/** How many filters are on (for the «Фильтры · 3» button). */
export const useActiveFilterCount = () => countRecipeFilters(useRecipeFilterState());
