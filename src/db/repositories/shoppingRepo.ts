import { and, asc, eq, inArray, ne } from 'drizzle-orm';

import type { Shortage } from '../../domain/pantry';
import { shoppingItemInputSchema, type ShoppingItemInput } from '../../domain/schemas';
import { purchaseAmount } from '../../domain/stock';
import { normalizeQuantity } from '../../domain/units';
import { newId } from '../../lib/id';
import {
  ingredients,
  lidlProducts,
  pantryItems,
  shoppingItems,
  type ShoppingItem,
} from '../schema';
import type { AppDb } from '../types';

/** Shopping amounts are whole grams/ml/pieces, rounded up so the recipe is covered. */
const toBuy = (amount: number) => Math.max(1, Math.ceil(amount - 1e-9));

export function createShoppingRepo(db: AppDb) {
  const openFor = (tx: AppDb, ingredientId: string, exceptId?: string) =>
    tx
      .select()
      .from(shoppingItems)
      .where(
        and(
          eq(shoppingItems.ingredientId, ingredientId),
          eq(shoppingItems.checked, false),
          exceptId ? ne(shoppingItems.id, exceptId) : undefined,
        ),
      )
      .get();

  const changePantry = (tx: AppDb, ingredientId: string, delta: number, now: number) => {
    const ingredient = tx.select().from(ingredients).where(eq(ingredients.id, ingredientId)).get();
    if (!ingredient) return;
    const row = tx
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.ingredientId, ingredientId))
      .get();
    const quantity = normalizeQuantity((row?.quantity ?? 0) + delta, ingredient.unit);
    tx.insert(pantryItems)
      .values({ ingredientId, quantity, unit: ingredient.unit, updatedAt: now })
      .onConflictDoUpdate({ target: pantryItems.ingredientId, set: { quantity, updatedAt: now } })
      .run();
  };

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
          const open = openFor(tx, s.ingredientId);
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

    /** Manual item; for a catalog ingredient it merges into the open item of that ingredient. */
    add(input: ShoppingItemInput, now: number = Date.now()): ShoppingItem {
      const values = shoppingItemInputSchema.parse(input);
      return db.transaction((tx) => {
        if (values.ingredientId) {
          const open = openFor(tx, values.ingredientId);
          if (open) {
            const quantity =
              values.quantity !== null && open.unit === values.unit
                ? (open.quantity ?? 0) + values.quantity
                : (values.quantity ?? open.quantity);
            return tx
              .update(shoppingItems)
              .set({ quantity, unit: values.unit ?? open.unit })
              .where(eq(shoppingItems.id, open.id))
              .returning()
              .get();
          }
        }
        return tx
          .insert(shoppingItems)
          .values({ id: newId(), ...values, createdAt: now })
          .returning()
          .get();
      });
    },

    list(): ShoppingItem[] {
      return db
        .select()
        .from(shoppingItems)
        .orderBy(asc(shoppingItems.checked), asc(shoppingItems.createdAt))
        .all();
    },

    listOpen(): ShoppingItem[] {
      return db.select().from(shoppingItems).where(eq(shoppingItems.checked, false)).all();
    },

    /**
     * «Купил»: adds whole Lidl packages (or the wanted amount) to the pantry. Un-checking
     * takes that amount back out. Idempotent for repeated taps in the same state.
     */
    setChecked(id: string, checked: boolean, now: number = Date.now()): void {
      db.transaction((tx) => {
        const item = tx.select().from(shoppingItems).where(eq(shoppingItems.id, id)).get();
        if (!item || item.checked === checked) return;

        if (checked) {
          let added: number | null = null;
          if (item.ingredientId) {
            const ingredient = tx
              .select()
              .from(ingredients)
              .where(eq(ingredients.id, item.ingredientId))
              .get();
            if (ingredient) {
              const product = tx
                .select()
                .from(lidlProducts)
                .where(eq(lidlProducts.ingredientId, ingredient.id))
                .orderBy(asc(lidlProducts.packageSize))
                .get();
              added = purchaseAmount(item, ingredient, product);
              if (added > 0) changePantry(tx, ingredient.id, added, now);
            }
          }
          tx.update(shoppingItems)
            .set({ checked: true, checkedAt: now, addedQuantity: added })
            .where(eq(shoppingItems.id, id))
            .run();
          return;
        }

        if (item.ingredientId && item.addedQuantity) {
          changePantry(tx, item.ingredientId, -item.addedQuantity, now);
        }
        // Another open item for the same ingredient may exist by now; keep just that one.
        if (item.ingredientId && openFor(tx, item.ingredientId, id)) {
          tx.delete(shoppingItems).where(eq(shoppingItems.id, id)).run();
        } else {
          tx.update(shoppingItems)
            .set({ checked: false, checkedAt: null, addedQuantity: null })
            .where(eq(shoppingItems.id, id))
            .run();
        }
      });
    },

    remove(id: string): void {
      db.delete(shoppingItems).where(eq(shoppingItems.id, id)).run();
    },

    /** Removes bought items; the pantry keeps what they added. */
    clearChecked(): number {
      return db
        .delete(shoppingItems)
        .where(eq(shoppingItems.checked, true))
        .returning({ id: shoppingItems.id })
        .all().length;
    },
  };
}

export type ShoppingRepo = ReturnType<typeof createShoppingRepo>;
