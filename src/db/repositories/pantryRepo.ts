import { asc, eq } from 'drizzle-orm';

import { pantryQuantitySchema } from '../../domain/schemas';
import { normalizeQuantity } from '../../domain/units';
import { ingredients, pantryItems, type PantryItem } from '../schema';
import type { AppDb } from '../types';

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

    remove(ingredientId: string): void {
      db.delete(pantryItems).where(eq(pantryItems.ingredientId, ingredientId)).run();
    },
  };
}

export type PantryRepo = ReturnType<typeof createPantryRepo>;
