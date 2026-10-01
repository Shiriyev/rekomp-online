import { eq, inArray } from 'drizzle-orm';

import type { PantryStock } from '../domain/pantry';
import { normalizeQuantity } from '../domain/units';
import { pantryItems, type PantryDelta } from './schema';
import type { AppDb } from './types';

/** Pantry rows for the given ingredients as a stock map. */
export function stockOf(tx: AppDb, ingredientIds: readonly string[]): PantryStock {
  if (ingredientIds.length === 0) return new Map();
  return new Map(
    tx
      .select()
      .from(pantryItems)
      .where(inArray(pantryItems.ingredientId, [...ingredientIds]))
      .all()
      .map((p) => [p.ingredientId, { quantity: p.quantity, unit: p.unit }]),
  );
}

/**
 * Subtracts amounts (ingredient unit), never more than is there. Returns what was really
 * taken, which is what Undo must give back.
 */
export function takeFromPantry(tx: AppDb, delta: PantryDelta, now: number): PantryDelta {
  const taken: PantryDelta = [];
  for (const d of delta) {
    const row = tx
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.ingredientId, d.ingredientId))
      .get();
    if (!row || row.quantity <= 0) continue;
    const amount = Math.min(d.amount, row.quantity);
    const quantity = normalizeQuantity(row.quantity - amount, row.unit);
    tx.update(pantryItems)
      .set({ quantity, updatedAt: now })
      .where(eq(pantryItems.ingredientId, d.ingredientId))
      .run();
    taken.push({ ingredientId: d.ingredientId, amount, unit: row.unit });
  }
  return taken;
}

/** Puts amounts back (Undo), re-creating rows that were removed meanwhile. */
export function returnToPantry(tx: AppDb, delta: PantryDelta, now: number): void {
  for (const d of delta) {
    const row = tx
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.ingredientId, d.ingredientId))
      .get();
    const quantity = normalizeQuantity((row?.quantity ?? 0) + d.amount, d.unit);
    tx.insert(pantryItems)
      .values({ ingredientId: d.ingredientId, quantity, unit: d.unit, updatedAt: now })
      .onConflictDoUpdate({ target: pantryItems.ingredientId, set: { quantity, updatedAt: now } })
      .run();
  }
}
