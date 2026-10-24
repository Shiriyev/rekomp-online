/**
 * prune — FIXES_v2.1 task 3: drops grill dishes and dishes built on rare products, then the
 * products no remaining dish uses. Pure: the catalog step feeds it recipes and the reviewed
 * lists, and writes reports/prune-review.md from the result.
 *
 * - Grill: a keyword in the name or the source instructions, or the «grill» equipment mark.
 *   Never adapted silently; a dish that a pan could do is only flagged «можно адаптировать».
 * - Rare product: used in fewer than `minRecipeUses` dishes, not sold at Lidl and not on the
 *   allowlist — or on the blocklist. Lidl data left the catalog in v7, so «sold at Lidl» is
 *   a hand-made list (mappings/ingredient-lidl.json).
 * - A dish goes when a mandatory line is rare; an optional rare line (garnish, «to taste»)
 *   is dropped from the dish instead. Uses are counted once over the dishes left after the
 *   grill step (the spec's order: count → drop dishes → drop unused products). With
 *   `cascade` the counts are taken again until nothing changes (every remaining product
 *   then has ≥ minRecipeUses uses among the remaining dishes) — far stricter.
 * - Manual lists win: recipe blocklist → out, recipe allowlist → in; protected recipes (the
 *   16 own v1 dishes) are never touched.
 */

export type PruneLine = { ingredientId: string; mandatory: boolean };

export type PruneRecipe = {
  id: string;
  nameEn: string;
  mealTypes: readonly string[];
  /** Name and source instructions, searched for grill words. */
  text: string;
  equipment: readonly string[];
  lines: readonly PruneLine[];
  /** v1 own recipes: never removed or changed. */
  protected: boolean;
};

export type PruneLists = {
  ingredientAllow: ReadonlySet<string>;
  /** Products Lidl Hungary sells (hand-made stand-in for the Open Food Facts variants). */
  ingredientShops: ReadonlySet<string>;
  ingredientBlock: ReadonlySet<string>;
  recipeAllow: ReadonlySet<string>;
  recipeBlock: ReadonlySet<string>;
};

export type PruneOptions = {
  minRecipeUses: number;
  /** Recount after each removal until stable (see the header). */
  cascade?: boolean;
  /** Grill words (regex sources, matched case-insensitively on word starts). */
  grillWords: readonly string[];
  /** Words that make a grill dish impossible in a pan (skewers, barbecue). */
  notAdaptableWords: readonly string[];
  /** Phrases removed before the search: a product, not a cooking method («bbq sauce»). */
  grillIgnore?: readonly string[];
};

export type RemovedRecipe = {
  id: string;
  nameEn: string;
  mealTypes: readonly string[];
  reason:
    | { kind: 'blocklist' }
    | { kind: 'grill'; match: string; adaptable: boolean }
    | { kind: 'rare'; products: { id: string; uses: number }[] };
};

export type PruneResult = {
  keptRecipes: Set<string>;
  /** recipe id → optional rare products dropped from it. */
  droppedLines: Map<string, string[]>;
  removedRecipes: RemovedRecipe[];
  /** Uses per product over the kept recipes (after dropped lines). */
  uses: Map<string, number>;
  /** Uses the rare decision was made on (= `uses` with cascade). */
  counted: Map<string, number>;
  keptProducts: Set<string>;
  removedProducts: string[];
  /** Kept dishes whose least-used non-allowlisted mandatory product is exactly at the limit. */
  borderline: { id: string; nameEn: string; products: { id: string; uses: number }[] }[];
};

const wordRe = (words: readonly string[]) => new RegExp(`(?<![\\p{L}])(${words.join('|')})`, 'iu');

export function prune(
  recipes: readonly PruneRecipe[],
  allProducts: readonly string[],
  lists: PruneLists,
  options: PruneOptions,
): PruneResult {
  for (const id of lists.ingredientAllow) {
    if (lists.ingredientBlock.has(id)) throw new Error(`${id} is on both product lists`);
  }
  for (const id of lists.recipeAllow) {
    if (lists.recipeBlock.has(id)) throw new Error(`${id} is on both recipe lists`);
  }
  const grill = wordRe(options.grillWords);
  const notAdaptable = wordRe(options.notAdaptableWords);
  const ignore = options.grillIgnore?.length
    ? new RegExp(options.grillIgnore.join('|'), 'giu')
    : null;
  const removed: RemovedRecipe[] = [];
  const kept = new Map<string, PruneRecipe>();
  const fixed = (r: PruneRecipe) => r.protected || lists.recipeAllow.has(r.id);

  for (const r of recipes) {
    if (r.protected) {
      kept.set(r.id, r);
      continue;
    }
    if (lists.recipeBlock.has(r.id)) {
      removed.push({ ...pick(r), reason: { kind: 'blocklist' } });
      continue;
    }
    const text = ignore ? r.text.replace(ignore, ' ') : r.text;
    const match = text.match(grill)?.[0] ?? (r.equipment.includes('grill') ? 'grill' : null);
    if (match && !lists.recipeAllow.has(r.id)) {
      const adaptable = !notAdaptable.test(text);
      removed.push({
        ...pick(r),
        reason: { kind: 'grill', match: match.toLowerCase(), adaptable },
      });
      continue;
    }
    kept.set(r.id, r);
  }

  const dropped = new Map<string, Set<string>>();
  const linesOf = (r: PruneRecipe) =>
    r.lines.filter((l) => !dropped.get(r.id)?.has(l.ingredientId));
  const countUses = () => {
    const uses = new Map<string, number>();
    for (const r of kept.values()) {
      for (const id of new Set(linesOf(r).map((l) => l.ingredientId))) {
        uses.set(id, (uses.get(id) ?? 0) + 1);
      }
    }
    return uses;
  };
  const isRare = (id: string, uses: ReadonlyMap<string, number>) =>
    !lists.ingredientAllow.has(id) &&
    (lists.ingredientBlock.has(id) ||
      (!lists.ingredientShops.has(id) && (uses.get(id) ?? 0) < options.minRecipeUses));

  // Removing a dish lowers the counts of its products; with `cascade`, repeat until stable.
  const firstUses = countUses();
  for (;;) {
    const uses = options.cascade ? countUses() : firstUses;
    let changed = false;
    for (const r of [...kept.values()]) {
      if (fixed(r)) continue;
      const rare = linesOf(r).filter((l) => isRare(l.ingredientId, uses));
      const mandatory = rare.filter((l) => l.mandatory);
      if (mandatory.length > 0) {
        kept.delete(r.id);
        const products = [...new Set(mandatory.map((l) => l.ingredientId))].map((id) => ({
          id,
          uses: uses.get(id) ?? 0,
        }));
        removed.push({ ...pick(r), reason: { kind: 'rare', products } });
        changed = true;
      } else if (rare.length > 0) {
        const set = dropped.get(r.id) ?? new Set<string>();
        rare.forEach((l) => set.add(l.ingredientId));
        dropped.set(r.id, set);
        changed = true;
      }
    }
    if (!changed || !options.cascade) break;
  }

  const uses = countUses();
  const counted = options.cascade ? uses : firstUses;
  const keptProducts = new Set(
    allProducts.filter((id) => lists.ingredientAllow.has(id) || uses.has(id)),
  );
  const borderline = [...kept.values()].flatMap((r) => {
    if (fixed(r)) return [];
    const products = [
      ...new Set(
        linesOf(r)
          .filter((l) => l.mandatory && !lists.ingredientAllow.has(l.ingredientId))
          .map((l) => l.ingredientId),
      ),
    ]
      .map((id) => ({ id, uses: counted.get(id) ?? 0 }))
      .filter((p) => p.uses === options.minRecipeUses);
    return products.length > 0 ? [{ id: r.id, nameEn: r.nameEn, products }] : [];
  });

  return {
    keptRecipes: new Set(kept.keys()),
    droppedLines: new Map([...dropped].map(([id, set]) => [id, [...set].sort()])),
    removedRecipes: removed,
    uses,
    counted,
    keptProducts,
    removedProducts: allProducts.filter((id) => !keptProducts.has(id)),
    borderline,
  };
}

const pick = (r: PruneRecipe) => ({ id: r.id, nameEn: r.nameEn, mealTypes: r.mealTypes });
