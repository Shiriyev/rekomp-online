import { and, eq, inArray, notInArray } from 'drizzle-orm';

import { LEGACY_CATEGORIES } from '../../domain/types';
import {
  appMeta,
  catalogMeta,
  cookSessions,
  ingredients,
  mealLogs,
  pantryItems,
  preparedPortions,
  recipeCustomAmounts,
  recipeIngredients,
  recipes,
  recipeSteps,
  shoppingItems,
} from '../schema';
import { SEED_INGREDIENTS } from '../seed/ingredients';
import type { AppDb } from '../types';
import type { Catalog } from './schema';

export const CATALOG_VERSION_KEY = 'catalogVersion';
/** Custom products the update could not match to the catalog: shown once, then cleared. */
export const UNSUPPORTED_PRODUCTS_KEY = 'unsupported_products';

// SQLite limits bound parameters per statement; small batches stay well below it.
const BATCH = 50;

export type CatalogUpdate =
  | { applied: false }
  | {
      applied: true;
      version: number;
      archived: { ingredients: number; recipes: number };
      deleted: { ingredients: number; recipes: number };
      /** Custom products moved onto a catalog product with the same name. */
      merged: number;
      /** Custom products with no catalog match (archived, listed for the user). */
      unsupported: string[];
    };

type Tx = Parameters<Parameters<AppDb['transaction']>[0]>[0];

export function storedCatalogVersion(db: AppDb | Tx): number {
  const row = db.select().from(catalogMeta).where(eq(catalogMeta.key, CATALOG_VERSION_KEY)).get();
  return row ? Number(row.value) : 0;
}

/** Lowercase, «ё» → «е», no accents or punctuation: how product names are compared. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function inBatches<T>(rows: readonly T[], insert: (batch: T[]) => void) {
  for (let i = 0; i < rows.length; i += BATCH) insert(rows.slice(i, i + BATCH));
}

/**
 * Brings the bundled catalog into the database when it is newer than the one applied, in
 * one transaction (any error leaves everything as it was). Catalog rows are upserted by
 * their stable ids; user data — pantry, logs, cook sessions, portions, profile, photos,
 * prices, own amounts, stock settings — is never overwritten. Catalog rows that left the
 * catalog are deleted when nothing refers to them, else archived (hidden from pickers,
 * still shown in history and at home). Running it again is a no-op.
 *
 * `load` is only called when an update is due: the catalog file is large.
 */
export function applyCatalog(db: AppDb, version: number, load: () => Catalog): CatalogUpdate {
  if (storedCatalogVersion(db) >= version) return { applied: false };
  const catalog = load();
  if (catalog.catalogVersion !== version) {
    throw new Error(`Catalog version ${catalog.catalogVersion}, expected ${version}`);
  }

  return db.transaction((tx) => {
    const firstCatalog = storedCatalogVersion(tx) === 0;

    // Old installs and v1 backups: v1 categories → catalog categories.
    for (const [legacy, next] of Object.entries(LEGACY_CATEGORIES)) {
      tx.update(ingredients)
        .set({ category: next })
        .where(eq(ingredients.category, legacy as never))
        .run();
    }

    // Before the first catalog nothing recorded user edits: a v1 product whose nutrition
    // differs from its v1 seed values was edited by the user, keep those values.
    if (firstCatalog) {
      for (const seed of SEED_INGREDIENTS) {
        const row = tx.select().from(ingredients).where(eq(ingredients.id, seed.id)).get();
        if (!row || row.isCustom) continue;
        const edited =
          row.kcalPer100g !== seed.kcalPer100g ||
          row.proteinPer100g !== seed.proteinPer100g ||
          (row.gramsPerPiece ?? null) !== (seed.gramsPerPiece ?? null);
        if (edited) {
          tx.update(ingredients)
            .set({ nutritionEdited: true })
            .where(eq(ingredients.id, seed.id))
            .run();
        }
      }
    }

    // ---------- products ----------
    const edited = new Set(
      tx
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.nutritionEdited, true))
        .all()
        .map((r) => r.id),
    );
    for (const i of catalog.ingredients) {
      const catalogColumns = {
        name: i.name,
        nameEn: i.nameEn,
        nameHu: i.nameHu,
        synonyms: i.synonyms,
        category: i.category,
        subcategory: i.subcategory,
        unit: i.unit,
        fatPer100g: i.fatPer100g,
        carbsPer100g: i.carbsPer100g,
        isStaple: i.isStaple,
        stockTracked: i.stockTracked,
        tags: i.tags,
        source: i.source,
        sourceId: i.sourceId,
        imageKey: i.imageKey,
        isCustom: false,
        isArchived: false,
      };
      const nutrition = {
        gramsPerPiece: i.gramsPerPiece,
        kcalPer100g: i.kcalPer100g,
        proteinPer100g: i.proteinPer100g,
      };
      tx.insert(ingredients)
        .values({ id: i.id, ...catalogColumns, ...nutrition })
        .onConflictDoUpdate({
          target: ingredients.id,
          set: edited.has(i.id) ? catalogColumns : { ...catalogColumns, ...nutrition },
        })
        .run();
    }

    // ---------- recipes (the user's own photo stays) ----------
    for (const r of catalog.recipes) {
      const { id, ...catalogColumns } = r;
      tx.insert(recipes)
        .values({ id, ...catalogColumns, isArchived: false })
        .onConflictDoUpdate({ target: recipes.id, set: { ...catalogColumns, isArchived: false } })
        .run();
    }
    const recipeIds = catalog.recipes.map((r) => r.id);
    inBatches(recipeIds, (ids) => {
      tx.delete(recipeIngredients).where(inArray(recipeIngredients.recipeId, ids)).run();
      tx.delete(recipeSteps).where(inArray(recipeSteps.recipeId, ids)).run();
    });
    inBatches(catalog.recipeIngredients, (rows) => tx.insert(recipeIngredients).values(rows).run());
    inBatches(catalog.recipeSteps, (rows) => tx.insert(recipeSteps).values(rows).run());

    // ---------- what left the catalog ----------
    const archived = { ingredients: 0, recipes: 0 };
    const deleted = { ingredients: 0, recipes: 0 };

    const goneRecipes = tx
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(notInArray(recipes.id, recipeIds), eq(recipes.isArchived, false)))
      .all()
      .map((r) => r.id);
    for (const id of goneRecipes) {
      const used =
        tx.select({ id: mealLogs.id }).from(mealLogs).where(eq(mealLogs.recipeId, id)).get() ??
        tx
          .select({ id: cookSessions.id })
          .from(cookSessions)
          .where(eq(cookSessions.recipeId, id))
          .get() ??
        tx
          .select({ id: preparedPortions.id })
          .from(preparedPortions)
          .where(eq(preparedPortions.recipeId, id))
          .get();
      if (used) {
        tx.update(recipes).set({ isArchived: true }).where(eq(recipes.id, id)).run();
        archived.recipes++;
      } else {
        tx.delete(recipes).where(eq(recipes.id, id)).run(); // lines, steps, own amounts cascade
        deleted.recipes++;
      }
    }

    const catalogIngredientIds = catalog.ingredients.map((i) => i.id);
    const goneIngredients = tx
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(
        and(
          notInArray(ingredients.id, catalogIngredientIds),
          eq(ingredients.isCustom, false),
          eq(ingredients.isArchived, false),
        ),
      )
      .all()
      .map((r) => r.id);
    for (const id of goneIngredients) {
      if (isReferenced(tx, id)) {
        tx.update(ingredients).set({ isArchived: true }).where(eq(ingredients.id, id)).run();
        archived.ingredients++;
      } else {
        tx.delete(ingredients).where(eq(ingredients.id, id)).run();
        deleted.ingredients++;
      }
    }

    // ---------- the user's own products ----------
    const byName = new Map<string, (typeof catalog.ingredients)[number]>();
    for (const i of catalog.ingredients) {
      for (const n of [i.name, i.nameEn, i.nameHu ?? '', ...i.synonyms]) {
        const key = normalizeName(n);
        if (key && !byName.has(key)) byName.set(key, i);
      }
    }
    let merged = 0;
    const unsupported: string[] = [];
    const customs = tx
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.isCustom, true), eq(ingredients.isArchived, false)))
      .all();
    for (const custom of customs) {
      const match = byName.get(normalizeName(custom.name));
      if (match && match.unit === custom.unit) {
        moveReferences(tx, custom.id, match.id);
        tx.delete(ingredients).where(eq(ingredients.id, custom.id)).run();
        merged++;
      } else {
        tx.update(ingredients).set({ isArchived: true }).where(eq(ingredients.id, custom.id)).run();
        unsupported.push(custom.name);
      }
    }
    if (unsupported.length > 0) {
      const previous = tx
        .select()
        .from(appMeta)
        .where(eq(appMeta.key, UNSUPPORTED_PRODUCTS_KEY))
        .get();
      const list = [
        ...new Set([...(previous ? (JSON.parse(previous.value) as string[]) : []), ...unsupported]),
      ];
      const value = JSON.stringify(list);
      tx.insert(appMeta)
        .values({ key: UNSUPPORTED_PRODUCTS_KEY, value })
        .onConflictDoUpdate({ target: appMeta.key, set: { value } })
        .run();
    }

    const value = String(version);
    tx.insert(catalogMeta)
      .values({ key: CATALOG_VERSION_KEY, value })
      .onConflictDoUpdate({ target: catalogMeta.key, set: { value } })
      .run();

    return { applied: true as const, version, archived, deleted, merged, unsupported };
  });
}

/** Whether pantry, shopping list, packages, recipes or own amounts still use a product. */
function isReferenced(tx: Tx, id: string): boolean {
  return Boolean(
    tx
      .select({ id: pantryItems.ingredientId })
      .from(pantryItems)
      .where(eq(pantryItems.ingredientId, id))
      .get() ??
    tx
      .select({ id: shoppingItems.id })
      .from(shoppingItems)
      .where(eq(shoppingItems.ingredientId, id))
      .get() ??
    tx
      .select({ id: recipeIngredients.recipeId })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.ingredientId, id))
      .get() ??
    tx
      .select({ id: recipeCustomAmounts.recipeId })
      .from(recipeCustomAmounts)
      .where(eq(recipeCustomAmounts.ingredientId, id))
      .get(),
  );
}

/** Points everything at `to` instead of `from`; stock at home is added up. */
function moveReferences(tx: Tx, from: string, to: string) {
  const fromStock = tx.select().from(pantryItems).where(eq(pantryItems.ingredientId, from)).get();
  if (fromStock) {
    const toStock = tx.select().from(pantryItems).where(eq(pantryItems.ingredientId, to)).get();
    if (toStock) {
      tx.update(pantryItems)
        .set({ quantity: toStock.quantity + fromStock.quantity, updatedAt: Date.now() })
        .where(eq(pantryItems.ingredientId, to))
        .run();
      tx.delete(pantryItems).where(eq(pantryItems.ingredientId, from)).run();
    } else {
      tx.update(pantryItems)
        .set({ ingredientId: to })
        .where(eq(pantryItems.ingredientId, from))
        .run();
    }
  }
  tx.update(shoppingItems)
    .set({ ingredientId: to })
    .where(eq(shoppingItems.ingredientId, from))
    .run();
  tx.delete(recipeCustomAmounts).where(eq(recipeCustomAmounts.ingredientId, from)).run();
}
