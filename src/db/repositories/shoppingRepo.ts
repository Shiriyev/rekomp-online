import { and, eq, inArray } from 'drizzle-orm';

import type { Shortage } from '../../domain/pantry';
import { newId } from '../../lib/id';
import { ingredients, shoppingItems } from '../schema';
import type { AppDb } from '../types';

/** Shopping amounts are whole grams/ml/pieces, rounded up so the recipe is covered. */
const toBuy = (amount: number) => Math.max(1, Math.ceil(amount - 1e-9));

export function createShoppingRepo(db: AppDb) {
  return {
    /**
     * Adds a recipe's shortages to the list. Idempotent per ingredient: an open item keeps
     * the larger of the two amounts, so pressing the button twice does not double it.
     * Returns how many ingredients were added or increased.
     */
    addMissing(shortages: readonly Shortage[], now: number = Date.now()): number {
      if (shortages.length === 0) return 0;
      return db.transaction((tx) => {
        const names = new Map(
          tx
            .select({ id: ingredients.id, name: ingredients.name })
            .from(ingredients)
            .where(
              inArray(
                ingredients.id,
                shortages.map((s) => s.ingredientId),
              ),
            )
            .all()
            .map((r) => [r.id, r.name]),
        );

        let changed = 0;
        for (const s of shortages) {
          const name = names.get(s.ingredientId);
          if (!name) throw new Error(`Ingredient not found: ${s.ingredientId}`);
          const quantity = toBuy(s.amount);
          const open = tx
            .select()
            .from(shoppingItems)
            .where(
              and(eq(shoppingItems.ingredientId, s.ingredientId), eq(shoppingItems.checked, false)),
            )
            .get();

          if (!open) {
            tx.insert(shoppingItems)
              .values({
                id: newId(),
                ingredientId: s.ingredientId,
                title: name,
                quantity,
                unit: s.unit,
                createdAt: now,
              })
              .run();
            changed++;
          } else if ((open.quantity ?? 0) < quantity || open.unit !== s.unit) {
            tx.update(shoppingItems)
              .set({ quantity, unit: s.unit })
              .where(eq(shoppingItems.id, open.id))
              .run();
            changed++;
          }
        }
        return changed;
      });
    },

    listOpen() {
      return db.select().from(shoppingItems).where(eq(shoppingItems.checked, false)).all();
    },
  };
}

export type ShoppingRepo = ReturnType<typeof createShoppingRepo>;
