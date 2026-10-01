import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';

import {
  manualLogInputSchema,
  mealLogEditSchema,
  photoUriSchema,
  type ManualLogInput,
  type MealLogEditInput,
} from '../../domain/schemas';
import { isAllowedEntryTime } from '../../domain/entryDetail';
import { planManualDeduction } from '../../domain/manualEntry';
import type { Macros } from '../../domain/types';
import { newId } from '../../lib/id';
import { logicalDateAt } from '../logicalDay';
import { returnToPantry, stockOf, takeFromPantry } from '../pantryMoves';
import { ingredients, mealLogs, preparedPortions, type MealLog } from '../schema';
import type { AppDb } from '../types';

export function createLogRepo(db: AppDb) {
  return {
    /**
     * Adds a manual entry and, optionally, takes the eaten products from «Дома» in the same
     * transaction (clamped at zero; what was really taken is kept for Undo). With an `id`
     * it is idempotent: a repeated save returns the first entry and deducts nothing.
     */
    addManual(input: ManualLogInput, now: number = Date.now()): MealLog {
      const data = manualLogInputSchema.parse(input);
      return db.transaction((tx) => {
        if (data.id) {
          const existing = tx.select().from(mealLogs).where(eq(mealLogs.id, data.id)).get();
          if (existing) return existing;
        }

        let pantryDelta = null;
        const items = data.deductions ?? [];
        if (items.length > 0) {
          const ids = [...new Set(items.map((i) => i.ingredientId))];
          const catalog = new Map(
            tx
              .select()
              .from(ingredients)
              .where(inArray(ingredients.id, ids))
              .all()
              .map((i) => [i.id, i]),
          );
          const { take } = planManualDeduction(items, catalog, stockOf(tx, ids));
          const taken = takeFromPantry(tx, take, now);
          pantryDelta = taken.length > 0 ? taken : null;
        }

        return tx
          .insert(mealLogs)
          .values({
            id: data.id ?? newId(),
            timestamp: now,
            localDate: logicalDateAt(tx, now),
            mealType: data.mealType,
            source: 'manual',
            name: data.name,
            kcal: data.kcal,
            protein: data.protein,
            servings: 1,
            photoUri: data.photoUri ?? null,
            pantryDelta,
          })
          .returning()
          .get();
      });
    },

    /** Sets or clears an entry's own photo; returns the previous one (to delete its file). */
    setPhoto(id: string, photoUri: string | null): string | null {
      const uri = photoUriSchema.parse(photoUri);
      return db.transaction((tx) => {
        const current = tx.select().from(mealLogs).where(eq(mealLogs.id, id)).get();
        if (!current) throw new Error(`Meal log not found: ${id}`);
        tx.update(mealLogs).set({ photoUri: uri }).where(eq(mealLogs.id, id)).run();
        return current.photoUri;
      });
    },

    /** Every stored photo reference, for the orphan-file sweep. */
    photoUris(): string[] {
      return db
        .selectDistinct({ uri: mealLogs.photoUri })
        .from(mealLogs)
        .where(isNotNull(mealLogs.photoUri))
        .all()
        .flatMap((r) => (r.uri ? [r.uri] : []));
    },

    isPhotoReferenced(photoUri: string): boolean {
      return (
        db
          .select({ id: mealLogs.id })
          .from(mealLogs)
          .where(eq(mealLogs.photoUri, photoUri))
          .limit(1)
          .get() !== undefined
      );
    },

    /**
     * Puts back a deleted entry (the «Отменить» of a delete). For an eaten portion it takes
     * the portion from the fridge again; if its products were returned on delete
     * (`productsReturned`), they are taken again. Idempotent per entry id.
     */
    restore(log: MealLog, options: { productsReturned?: boolean } = {}): void {
      db.transaction((tx) => {
        const exists = tx
          .select({ id: mealLogs.id })
          .from(mealLogs)
          .where(eq(mealLogs.id, log.id))
          .get();
        if (exists) return;
        if (log.portionId) {
          const taken = tx
            .update(preparedPortions)
            .set({ portionsLeft: sql`${preparedPortions.portionsLeft} - 1` })
            .where(
              and(eq(preparedPortions.id, log.portionId), gt(preparedPortions.portionsLeft, 0)),
            )
            .returning({ id: preparedPortions.id })
            .all();
          if (taken.length === 0) throw new Error('The portion is no longer in the fridge');
        }
        let pantryDelta = log.pantryDelta;
        if (options.productsReturned && pantryDelta && pantryDelta.length > 0) {
          const taken = takeFromPantry(tx, pantryDelta, Date.now());
          pantryDelta = taken.length > 0 ? taken : null;
        }
        tx.insert(mealLogs)
          .values({ ...log, pantryDelta })
          .run();
      });
    },

    listByDate(localDate: string): MealLog[] {
      return db
        .select()
        .from(mealLogs)
        .where(eq(mealLogs.localDate, localDate))
        .orderBy(asc(mealLogs.timestamp))
        .all();
    },

    dayTotals(localDate: string): Macros {
      const row = db
        .select({
          kcal: sql<number>`coalesce(sum(${mealLogs.kcal}), 0)`,
          protein: sql<number>`coalesce(sum(${mealLogs.protein}), 0)`,
        })
        .from(mealLogs)
        .where(eq(mealLogs.localDate, localDate))
        .get();
      return { kcal: row?.kcal ?? 0, protein: row?.protein ?? 0 };
    },

    remove(id: string): void {
      db.delete(mealLogs).where(eq(mealLogs.id, id)).run();
    },

    get(id: string): MealLog | undefined {
      return db.select().from(mealLogs).where(eq(mealLogs.id, id)).get();
    },

    /** The most recent entry, for «Отменить последнее» in the history. */
    latest(): MealLog | undefined {
      return db.select().from(mealLogs).orderBy(desc(mealLogs.timestamp)).limit(1).get();
    },

    /**
     * Corrects an entry; the name of recipe/portion entries stays tied to the dish. A new
     * time re-derives the logical day, so the entry may move to another day.
     */
    update(id: string, input: MealLogEditInput, now: number = Date.now()): MealLog {
      const { timestamp, ...values } = mealLogEditSchema.parse(input);
      if (timestamp !== undefined && !isAllowedEntryTime(timestamp, now)) {
        throw new RangeError('Время записи не может быть в будущем');
      }
      return db.transaction((tx) => {
        const current = tx.select().from(mealLogs).where(eq(mealLogs.id, id)).get();
        if (!current) throw new Error(`Meal log not found: ${id}`);
        const moved =
          timestamp === undefined || timestamp === current.timestamp
            ? {}
            : { timestamp, localDate: logicalDateAt(tx, timestamp) };
        return tx
          .update(mealLogs)
          .set({
            ...values,
            ...moved,
            name: current.source === 'manual' ? values.name : current.name,
          })
          .where(eq(mealLogs.id, id))
          .returning()
          .get();
      });
    },

    /**
     * Deletes only the log line of a cooked dish or a manual entry; products stay deducted
     * and fridge portions stay as they are. Use `undo` / cook.undo to also return products.
     */
    removeEntryOnly(id: string): void {
      db.delete(mealLogs)
        .where(and(eq(mealLogs.id, id), inArray(mealLogs.source, ['recipe', 'manual'])))
        .run();
    },

    /** Latest manual entries, newest first, for quick presets. */
    recentManual(limit = 50): MealLog[] {
      return db
        .select()
        .from(mealLogs)
        .where(eq(mealLogs.source, 'manual'))
        .orderBy(desc(mealLogs.timestamp))
        .limit(limit)
        .all();
    },

    /**
     * Undoes a log entry: deletes it, gives back products a manual entry took and, for an
     * eaten portion, puts the portion back. Idempotent: undoing an already removed entry is
     * a no-op. Cooking undo lives with cook sessions (it also restores pantry items).
     */
    undo(id: string, now: number = Date.now()): void {
      db.transaction((tx) => {
        const log = tx.select().from(mealLogs).where(eq(mealLogs.id, id)).get();
        if (!log) return;
        if (log.source === 'recipe' && log.cookSessionId) {
          throw new Error('Cooking entries are undone through the cook session');
        }
        if (log.portionId) {
          tx.update(preparedPortions)
            .set({ portionsLeft: sql`${preparedPortions.portionsLeft} + 1` })
            .where(eq(preparedPortions.id, log.portionId))
            .run();
        }
        if (log.pantryDelta) returnToPantry(tx, log.pantryDelta, now);
        tx.delete(mealLogs).where(eq(mealLogs.id, id)).run();
      });
    },
  };
}

export type LogRepo = ReturnType<typeof createLogRepo>;
