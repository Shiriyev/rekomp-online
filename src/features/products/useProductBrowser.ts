import { useMemo, useState } from 'react';

import type { Ingredient } from '@/db/schema';
import {
  applyProductFilters,
  productCounts,
  sortProductList,
  type ProductFacts,
} from '@/domain/productFilters';
import { createSearchIndex } from '@/domain/search';
import { isLowStock } from '@/domain/stock';
import { useProductPopularity } from './usePopularity';
import { useContent } from '@/i18n/content';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

import { useProductScreen, type ProductScreen } from './productFiltersStore';

/** Typing settles for this long before the list is searched again. */
const SEARCH_DEBOUNCE_MS = 150;

export type ProductBrowser = ReturnType<typeof useProductBrowser>;

/**
 * Search, chips, filters and sort of one product screen over `products`: the search index
 * is built when the products change (not per keystroke) and the query is debounced.
 * `stock` is what is at home by product id. While searching, results keep the relevance
 * order; otherwise the chosen sort applies.
 */
export function useProductBrowser(
  screen: ProductScreen,
  products: readonly Ingredient[],
  stock: ReadonlyMap<string, number>,
) {
  const content = useContent();
  const popularity = useProductPopularity();
  const { state, update, reset } = useProductScreen(screen);
  const [query, setQuery] = useState('');
  const settled = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const facts = useMemo(() => {
    const map = new Map<string, ProductFacts>();
    for (const i of products) {
      const quantity = stock.get(i.id) ?? null;
      map.set(i.id, {
        id: i.id,
        name: content.ingredientName(i),
        category: i.category,
        subcategory: i.subcategory,
        kcalPer100g: i.kcalPer100g,
        proteinPer100g: i.proteinPer100g,
        tags: i.tags,
        quantity,
        low: quantity !== null && isLowStock(quantity, i.unit, i.lowStockThreshold),
        uses: popularity.get(i.id) ?? 0,
      });
    }
    return map;
  }, [products, stock, content, popularity]);
  const factsOf = useMemo(() => (i: Ingredient) => facts.get(i.id)!, [facts]);

  const index = useMemo(
    () => createSearchIndex(products, (i) => [i.name, i.nameHu, ...content.searchAliases(i)]),
    [products, content],
  );
  const searching = settled.trim() !== '';
  const searched = useMemo(() => index.search(settled, { fuzzy: true }), [index, settled]);

  const results = useMemo(() => {
    const filtered = applyProductFilters(searched.items, state, factsOf);
    return searching ? filtered : sortProductList(filtered, state.sort, factsOf);
  }, [searched, state, factsOf, searching]);
  const counts = useMemo(
    () => productCounts(searched.items, state, factsOf),
    [searched, state, factsOf],
  );

  return {
    state,
    update,
    reset,
    query,
    setQuery,
    /** True while the debounced query has not caught up with the field. */
    pending: query !== settled,
    results,
    counts,
    /** Results are look-alikes: nothing matched the query exactly. */
    similar: searched.similar,
    factsOf,
  };
}
