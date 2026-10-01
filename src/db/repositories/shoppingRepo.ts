import { and, asc, eq, inArray, ne } from 'drizzle-orm';

import type { Shortage } from '../../domain/pantry';
import { shoppingItemInputSchema, type ShoppingItemInput } from '../../domain/schemas';
import { purchaseAmount } from '../../domain/stock';
import { convertAmount, normalizeQuantity } from '../../domain/units';
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

  const smallestPackage = (tx: AppDb, ingredientId: string) =>
    tx
      .select()
      .from(lidlProducts)
      .where(eq(lidlProducts.ingredientId, ingredientId))
      .orderBy(asc(lidlProducts.packageSize))
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
        const byId = new Map(
          tx
            .select()
            .from(ingredients)
            .where(
              inArray(
                ingredients.id,
                shortages.map((s) => s.ingredientId),
              ),
            )
            .all()
            .map((r) => [r.id, r]),
        );

        let changed = 0;
        for (const s of shortages) {
          const ingredient = byId.get(s.ingredientId);
          if (!ingredient) throw new Error(`Ingredient not found: ${s.ingredientId}`);
          const name = ingredient.name;
          // The list shows what to actually buy: whole Lidl packages when the catalog knows them.
          const product = smallestPackage(tx, ingredient.id);
          const inIngredientUnit = convertAmount(s.amount, s.unit, ingredient.unit, ingredient);
          const quantity = product
            ? normalizeQuantity(
                purchaseAmount(
                  { quantity: inIngredientUnit, unit: ingredient.unit },
                  ingredient,
                  product,
                ),
                ingredient.unit,
              )
            : toBuy(inIngredientUnit);
          const unit = ingredient.unit;
          const open = openFor(tx, s.ingredientId);
          if (!open) {
            tx.insert(shoppingItems)
              .values({
                id: newId(),
                ingredientId: s.ingredientId,
                title: name,
                quantity,
                unit,
                createdAt: now,
              })
              .run();
            changed++;
          } else if ((open.quantity ?? 0) < quantity || open.unit !== unit) {
            tx.update(shoppingItems)
              .set({ quantity, unit })
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
              // Exactly what the list says; without an amount, one package (or 1 шт).
              added =
                item.quantity !== null && item.unit !== null
                  ? convertAmount(item.quantity, item.unit, ingredient.unit, ingredient)
                  : purchaseAmount(
                      { quantity: null, unit: null },
                      ingredient,
                      smallestPackage(tx, ingredient.id),
                    );
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

    /**
     * «Купил несколько»: checks off several open items at once, adding the given amounts
     * (ingredient unit) to the pantry, in one transaction. Returns the ids checked.
     */
    checkMany(
      entries: readonly { itemId: string; amount: number }[],
      now: number = Date.now(),
    ): string[] {
      for (const e of entries) {
        if (!Number.isFinite(e.amount) || e.amount <= 0 || e.amount > 1_000_000) {
          throw new RangeError(`Invalid amount ${e.amount}`);
        }
      }
      return db.transaction((tx) => {
        const checked: string[] = [];
        for (const { itemId, amount } of entries) {
          const item = tx.select().from(shoppingItems).where(eq(shoppingItems.id, itemId)).get();
          if (!item || item.checked || !item.ingredientId) continue;
          const ingredient = tx
            .select()
            .from(ingredients)
            .where(eq(ingredients.id, item.ingredientId))
            .get();
          if (!ingredient) continue;
          const added = normalizeQuantity(amount, ingredient.unit);
          changePantry(tx, ingredient.id, added, now);
          tx.update(ingredients)
            .set({ lastAddedAmount: added })
            .where(eq(ingredients.id, ingredient.id))
            .run();
          tx.update(shoppingItems)
            .set({ checked: true, checkedAt: now, addedQuantity: added })
            .where(eq(shoppingItems.id, itemId))
            .run();
          checked.push(itemId);
        }
        return checked;
      });
    },

    /** Undo of `checkMany`: un-checks all of them (taking their amounts back) at once. */
    uncheckMany(itemIds: readonly string[], now: number = Date.now()): void {
      db.transaction((tx) => {
        const repo = createShoppingRepo(tx);
        for (const id of itemIds) repo.setChecked(id, false, now);
      });
    },

    /** Changes how much to buy of an open item (in its unit); must stay positive. */
    setQuantity(id: string, quantity: number): void {
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
        throw new RangeError(`quantity must be positive, got ${quantity}`);
      }
      const item = db.select().from(shoppingItems).where(eq(shoppingItems.id, id)).get();
      if (!item || item.checked) return;
      const value = item.unit ? normalizeQuantity(quantity, item.unit) : quantity;
      db.update(shoppingItems).set({ quantity: value }).where(eq(shoppingItems.id, id)).run();
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
