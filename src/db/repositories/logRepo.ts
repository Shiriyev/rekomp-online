import { and, asc, desc, eq, sql } from 'drizzle-orm';

import {
  manualLogInputSchema,
  mealLogEditSchema,
  type ManualLogInput,
  type MealLogEditInput,
} from '../../domain/schemas';
import type { Macros } from '../../domain/types';
import { newId } from '../../lib/id';
import { logicalDateAt } from '../logicalDay';
import { mealLogs, preparedPortions, type MealLog } from '../schema';
import type { AppDb } from '../types';

export function createLogRepo(db: AppDb) {
  return {
    addManual(input: ManualLogInput, now: number = Date.now()): MealLog {
      const data = manualLogInputSchema.parse(input);
      return db
        .insert(mealLogs)
        .values({
          id: newId(),
          timestamp: now,
          localDate: logicalDateAt(db, now),
          mealType: data.mealType,
          source: 'manual',
          name: data.name,
          kcal: data.kcal,
          protein: data.protein,
          servings: 1,
        })
        .returning()
        .get();
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

    /** Corrects an entry; the name of recipe/portion entries stays tied to the dish. */
    update(id: string, input: MealLogEditInput): MealLog {
      const values = mealLogEditSchema.parse(input);
      const current = db.select().from(mealLogs).where(eq(mealLogs.id, id)).get();
      if (!current) throw new Error(`Meal log not found: ${id}`);
      return db
        .update(mealLogs)
        .set({ ...values, name: current.source === 'manual' ? values.name : current.name })
        .where(eq(mealLogs.id, id))
        .returning()
        .get();
    },

    /**
     * Deletes only the log line of a cooked dish; pantry and fridge portions stay as they are.
     * Use cook.undo to also return products.
     */
    removeCookedEntryOnly(id: string): void {
      db.delete(mealLogs)
        .where(and(eq(mealLogs.id, id), eq(mealLogs.source, 'recipe')))
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
     * Undoes a log entry: deletes it and, for an eaten portion, puts the portion back.
     * Idempotent: undoing an already removed entry is a no-op. Cooking undo lives with
     * cook sessions (it also restores pantry items).
     */
    undo(id: string): void {
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
        tx.delete(mealLogs).where(eq(mealLogs.id, id)).run();
      });
    },
  };
}

export type LogRepo = ReturnType<typeof createLogRepo>;
