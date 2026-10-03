import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  DEFAULT_PRODUCT_FILTERS,
  PRODUCT_DIETS,
  PRODUCT_KCAL_IDS,
  PRODUCT_SORTS,
  PRODUCT_STOCK,
  type ProductFilters,
} from '@/domain/productFilters';
import { INGREDIENT_CATEGORIES } from '@/domain/types';
import { persistStorage } from '@/lib/persistStorage';

/** Each product screen remembers its own filters, sort and view. */
export const PRODUCT_SCREENS = ['home', 'add', 'shopping'] as const;
export type ProductScreen = (typeof PRODUCT_SCREENS)[number];

export type ProductView = 'grid' | 'list';
export type ProductScreenState = ProductFilters & { view: ProductView };

const initial = (): Record<ProductScreen, ProductScreenState> => ({
  home: { ...DEFAULT_PRODUCT_FILTERS, view: 'grid' },
  add: { ...DEFAULT_PRODUCT_FILTERS, view: 'grid' },
  shopping: { ...DEFAULT_PRODUCT_FILTERS, view: 'list' },
});

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  list.includes(v as T) ? (v as T) : null;

/** A saved state from an older version may hold values that no longer exist. */
function clean(saved: Partial<ProductScreenState>, base: ProductScreenState): ProductScreenState {
  const category = oneOf(INGREDIENT_CATEGORIES, saved.category);
  return {
    category,
    subcategory: category && typeof saved.subcategory === 'string' ? saved.subcategory : null,
    stock: oneOf(PRODUCT_STOCK, saved.stock),
    usedInRecipes: saved.usedInRecipes === true,
    highProtein: saved.highProtein === true,
    kcal: oneOf(PRODUCT_KCAL_IDS, saved.kcal),
    diets: Array.isArray(saved.diets) ? saved.diets.filter((d) => oneOf(PRODUCT_DIETS, d)) : [],
    sort: oneOf(PRODUCT_SORTS, saved.sort) ?? base.sort,
    view: saved.view === 'list' || saved.view === 'grid' ? saved.view : base.view,
  };
}

type Store = {
  screens: Record<ProductScreen, ProductScreenState>;
  update: (screen: ProductScreen, patch: Partial<ProductScreenState>) => void;
  /** «Сбросить»: filters and chips back to all; the sort and the view stay. */
  reset: (screen: ProductScreen) => void;
};

export const useProductFiltersStore = create<Store>()(
  persist(
    (set) => ({
      screens: initial(),
      update: (screen, patch) =>
        set((s) => ({ screens: { ...s.screens, [screen]: { ...s.screens[screen], ...patch } } })),
      reset: (screen) =>
        set((s) => {
          const { sort, view } = s.screens[screen];
          return {
            screens: { ...s.screens, [screen]: { ...DEFAULT_PRODUCT_FILTERS, sort, view } },
          };
        }),
    }),
    {
      name: 'product-filters',
      version: 1,
      storage: persistStorage,
      partialize: (s) => ({ screens: s.screens }),
      // Unknown values get their defaults; unknown screens are dropped.
      merge: (persisted, current) => {
        const saved = (persisted as Partial<Pick<Store, 'screens'>> | undefined)?.screens;
        const screens = { ...current.screens };
        for (const screen of Object.keys(screens) as ProductScreen[]) {
          if (saved?.[screen]) screens[screen] = clean(saved[screen], screens[screen]);
        }
        return { ...current, screens };
      },
    },
  ),
);

/** The state of one screen and setters bound to it. */
export function useProductScreen(screen: ProductScreen) {
  const state = useProductFiltersStore((s) => s.screens[screen]);
  const update = useProductFiltersStore((s) => s.update);
  const reset = useProductFiltersStore((s) => s.reset);
  return {
    state,
    update: (patch: Partial<ProductScreenState>) => update(screen, patch),
    reset: () => reset(screen),
  };
}
