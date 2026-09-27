import { and, asc, eq, gt, sql } from 'drizzle-orm';

import { toLocalDate } from '../../domain/dates';
import type { MealType } from '../../domain/types';
import { newId } from '../../lib/id';
import { mealLogs, preparedPortions, recipes, type MealLog, type PreparedPortion } from '../schema';
import type { AppDb } from '../types';

export class NoPortionsLeftError extends Error {
  constructor(portionId: string) {
    super(`No portions left for ${portionId}`);
    this.name = 'NoPortionsLeftError';
  }
}

export type AvailablePortion = PreparedPortion & { recipeName: string };

export function createPortionsRepo(db: AppDb) {
  return {
    /** Corrects the count (e.g. a portion was given away); 0 removes it from the fridge list. */
    setPortionsLeft(portionId: string, portionsLeft: number): void {
      if (!Number.isInteger(portionsLeft) || portionsLeft < 0 || portionsLeft > 20) {
        throw new RangeError(`portionsLeft must be an integer 0–20, got ${portionsLeft}`);
      }
      db.update(preparedPortions)
        .set({ portionsLeft })
        .where(eq(preparedPortions.id, portionId))
        .run();
    },

    /** Containers in the fridge that still have portions, oldest first (eat those first). */
    listAvailable(): AvailablePortion[] {
      return db
        .select({ portion: preparedPortions, recipeName: recipes.name })
        .from(preparedPortions)
        .innerJoin(recipes, eq(recipes.id, preparedPortions.recipeId))
        .where(gt(preparedPortions.portionsLeft, 0))
        .orderBy(asc(preparedPortions.cookedAt))
        .all()
        .map((r) => ({ ...r.portion, recipeName: r.recipeName }));
    },

    /** Eats one portion: decrements the container and logs it, atomically. */
    eat(portionId: string, mealType: MealType, now: number = Date.now()): MealLog {
      return db.transaction((tx) => {
        const row = tx
          .select({ portion: preparedPortions, recipeName: recipes.name })
          .from(preparedPortions)
          .innerJoin(recipes, eq(recipes.id, preparedPortions.recipeId))
          .where(eq(preparedPortions.id, portionId))
          .get();
        if (!row || row.portion.portionsLeft <= 0) throw new NoPortionsLeftError(portionId);

        // Conditional decrement guards against a concurrent double tap.
        const updated = tx
          .update(preparedPortions)
          .set({ portionsLeft: sql`${preparedPortions.portionsLeft} - 1` })
          .where(and(eq(preparedPortions.id, portionId), gt(preparedPortions.portionsLeft, 0)))
          .returning({ id: preparedPortions.id })
          .all();
        if (updated.length === 0) throw new NoPortionsLeftError(portionId);

        return tx
          .insert(mealLogs)
          .values({
            id: newId(),
            timestamp: now,
            localDate: toLocalDate(now),
            mealType,
            source: 'portion',
            recipeId: row.portion.recipeId,
            name: row.recipeName,
            kcal: row.portion.kcalPerPortion,
            protein: row.portion.proteinPerPortion,
            servings: 1,
            portionId,
          })
          .returning()
          .get();
      });
    },
  };
}

export type PortionsRepo = ReturnType<typeof createPortionsRepo>;
