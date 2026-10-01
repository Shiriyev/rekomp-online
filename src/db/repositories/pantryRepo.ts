import { asc, eq, inArray } from 'drizzle-orm';

import { afterAdding } from '../../domain/bulkAdd';
import { pantryQuantitySchema } from '../../domain/schemas';
import { normalizeQuantity } from '../../domain/units';
import { ingredients, pantryItems, type PantryItem } from '../schema';
import type { AppDb } from '../types';

/** One product of a bulk add, in the ingredient's unit. */
export type BulkAddItem = { ingredientId: string; amount: number };

/** What a bulk add did, so Undo can take exactly that back. */
export type BulkAddResult = {
  items: { ingredientId: string; amount: number; created: boolean }[];
};

export class InvalidBulkAddError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBulkAddError';
  }
}

export function createPantryRepo(db: AppDb) {
  const unitOf = (ingredientId: string) => {
    const row = db
      .select({ unit: ingredients.unit })
      .from(ingredients)
      .where(eq(ingredients.id, ingredientId))
      .get();
    if (!row) throw new Error(`Ingredient not found: ${ingredientId}`);
    return row.unit;
  };

  const get = (ingredientId: string): PantryItem | undefined =>
    db.select().from(pantryItems).where(eq(pantryItems.ingredientId, ingredientId)).get();

  /** Sets an absolute quantity in the ingredient's own unit. Negative values are rejected. */
  const setQuantity = (
    ingredientId: string,
    quantity: number,
    now: number = Date.now(),
  ): PantryItem => {
    const unit = unitOf(ingredientId);
    const value = normalizeQuantity(pantryQuantitySchema.parse(quantity), unit);
    const row = { ingredientId, quantity: value, unit, updatedAt: now };
    return db
      .insert(pantryItems)
      .values(row)
      .onConflictDoUpdate({
        target: pantryItems.ingredientId,
        set: { quantity: value, unit, updatedAt: now },
      })
      .returning()
      .get();
  };

  return {
    list(): PantryItem[] {
      return db.select().from(pantryItems).orderBy(asc(pantryItems.ingredientId)).all();
    },

    get,
    setQuantity,

    /** Adds (or subtracts) and clamps at zero. Runs atomically. */
    adjust(ingredientId: string, delta: number, now: number = Date.now()): PantryItem {
      if (!Number.isFinite(delta)) throw new RangeError(`Invalid delta ${delta}`);
      return db.transaction((tx) => {
        const repo = createPantryRepo(tx);
        const current = repo.get(ingredientId)?.quantity ?? 0;
        return repo.setQuantity(ingredientId, Math.max(0, current + delta), now);
      });
    },

    /**
     * «Добавить всё»: adds every amount to what is at home (summing with existing stock)
     * in one transaction; any invalid item rolls back the whole batch. Duplicates are
     * merged. Remembers each amount as the product's next default.
     */
    addMany(items: readonly BulkAddItem[], now: number = Date.now()): BulkAddResult {
      const merged = new Map<string, number>();
      for (const item of items) {
        if (!Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 1_000_000) {
          throw new InvalidBulkAddError(`Invalid amount ${item.amount} for ${item.ingredientId}`);
        }
        merged.set(item.ingredientId, (merged.get(item.ingredientId) ?? 0) + item.amount);
      }
      if (merged.size === 0) return { items: [] };

      return db.transaction((tx) => {
        const ids = [...merged.keys()];
        const catalog = new Map(
          tx
            .select()
            .from(ingredients)
            .where(inArray(ingredients.id, ids))
            .all()
            .map((i) => [i.id, i]),
        );
        const result: BulkAddResult = { items: [] };
        for (const [ingredientId, raw] of merged) {
          const ingredient = catalog.get(ingredientId);
          if (!ingredient) throw new InvalidBulkAddError(`Ingredient not found: ${ingredientId}`);
          const amount = normalizeQuantity(raw, ingredient.unit);
          const current = tx
            .select()
            .from(pantryItems)
            .where(eq(pantryItems.ingredientId, ingredientId))
            .get();
          const quantity = afterAdding(current?.quantity ?? null, amount, ingredient.unit);
          tx.insert(pantryItems)
            .values({ ingredientId, quantity, unit: ingredient.unit, updatedAt: now })
            .onConflictDoUpdate({
              target: pantryItems.ingredientId,
              set: { quantity, updatedAt: now },
            })
            .run();
          tx.update(ingredients)
            .set({ lastAddedAmount: amount })
            .where(eq(ingredients.id, ingredientId))
            .run();
          result.items.push({ ingredientId, amount, created: current === undefined });
        }
        return result;
      });
    },

    /** Undo of `addMany`: takes the added amounts back; rows the batch created disappear. */
    undoAddMany(result: BulkAddResult, now: number = Date.now()): void {
      db.transaction((tx) => {
        for (const item of result.items) {
          const row = tx
            .select()
            .from(pantryItems)
            .where(eq(pantryItems.ingredientId, item.ingredientId))
            .get();
          if (!row) continue;
          const quantity = normalizeQuantity(row.quantity - item.amount, row.unit);
          if (item.created && quantity === 0) {
            tx.delete(pantryItems).where(eq(pantryItems.ingredientId, item.ingredientId)).run();
          } else {
            tx.update(pantryItems)
              .set({ quantity, updatedAt: now })
              .where(eq(pantryItems.ingredientId, item.ingredientId))
              .run();
          }
        }
      });
    },

    remove(ingredientId: string): void {
      db.delete(pantryItems).where(eq(pantryItems.ingredientId, ingredientId)).run();
    },
  };
}

export type PantryRepo = ReturnType<typeof createPantryRepo>;
