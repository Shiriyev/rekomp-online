import { and, asc, count, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm';

import { afterTaking, planConsumption } from '../../domain/cooking';
import { recipeMacros, roundKcal, roundProtein } from '../../domain/nutrition';
import type { PantryStock } from '../../domain/pantry';
import type { Macros, MealType } from '../../domain/types';
import { normalizeQuantity } from '../../domain/units';
import { newId } from '../../lib/id';
import { logicalDateAt } from '../logicalDay';
import {
  cookSessions,
  ingredients,
  mealLogs,
  pantryItems,
  preparedPortions,
  recipeIngredients,
  recipes,
  type CookProgress,
  type CookSession,
} from '../schema';
import type { AppDb } from '../types';

export class CookSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CookSessionError';
  }
}

export const MAX_SERVINGS = 8;

export type FinishOptions = { eatNow: boolean; mealType: MealType };

export type FinishResult = {
  sessionId: string;
  recipeId: string;
  /** Rounded per-portion macros as logged. */
  perPortion: Macros;
  servings: number;
  eaten: number;
  stored: number;
  logId: string | null;
  portionId: string | null;
  /** First successful cook of this recipe (for the badge). */
  firstTime: boolean;
  /** True when this call found the session already finished (idempotent retry). */
  alreadyFinished: boolean;
};

export type ActiveSession = CookSession & { recipeName: string };

export type UndoPreview =
  | { canUndo: true; products: PantryDeltaItem[]; portionsToRemove: number }
  | { canUndo: false; reason: 'portions_eaten' | 'not_finished' | 'already_undone' | 'not_found' };

type PantryDeltaItem = { ingredientId: string; amount: number; unit: 'g' | 'ml' | 'pcs' };

const validateServings = (servings: number) => {
  if (!Number.isInteger(servings) || servings < 1 || servings > MAX_SERVINGS) {
    throw new RangeError(`servings must be an integer 1–${MAX_SERVINGS}, got ${servings}`);
  }
};

export function createCookRepo(db: AppDb) {
  const getSession = (tx: AppDb, id: string) =>
    tx.select().from(cookSessions).where(eq(cookSessions.id, id)).get();

  const resultOf = (
    tx: AppDb,
    session: CookSession,
    alreadyFinished: boolean,
    firstTime: boolean,
  ): FinishResult => {
    const log = tx.select().from(mealLogs).where(eq(mealLogs.cookSessionId, session.id)).get();
    const portion = tx
      .select()
      .from(preparedPortions)
      .where(eq(preparedPortions.cookSessionId, session.id))
      .get();
    const perPortion = log
      ? { kcal: log.kcal, protein: log.protein }
      : { kcal: portion?.kcalPerPortion ?? 0, protein: portion?.proteinPerPortion ?? 0 };
    const eaten = log ? 1 : 0;
    return {
      sessionId: session.id,
      recipeId: session.recipeId,
      perPortion,
      servings: session.servings,
      eaten,
      stored: session.servings - eaten,
      logId: log?.id ?? null,
      portionId: portion?.id ?? null,
      firstTime,
      alreadyFinished,
    };
  };

  const startIn = (
    tx: AppDb,
    recipeId: string,
    servings: number,
    choices: Record<string, string>,
    now: number,
  ): CookSession => {
    validateServings(servings);
    const recipe = tx
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .get();
    if (!recipe) throw new CookSessionError(`Recipe not found: ${recipeId}`);
    // Only one cooking session is active at a time.
    tx.update(cookSessions)
      .set({ abandonedAt: now })
      .where(and(isNull(cookSessions.finishedAt), isNull(cookSessions.abandonedAt)))
      .run();
    return tx
      .insert(cookSessions)
      .values({ id: newId(), recipeId, servings, choices, startedAt: now })
      .returning()
      .get();
  };

  const finishIn = (
    tx: AppDb,
    sessionId: string,
    options: FinishOptions,
    now: number,
  ): FinishResult => {
    const session = getSession(tx, sessionId);
    if (!session) throw new CookSessionError(`Cook session not found: ${sessionId}`);
    if (session.undoneAt !== null || session.abandonedAt !== null) {
      throw new CookSessionError('Cook session is closed');
    }
    if (session.finishedAt !== null) return resultOf(tx, session, true, false);

    const recipe = tx.select().from(recipes).where(eq(recipes.id, session.recipeId)).get();
    if (!recipe) throw new CookSessionError(`Recipe not found: ${session.recipeId}`);
    const lines = tx
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipe.id))
      .orderBy(asc(recipeIngredients.sortOrder))
      .all();
    const ingredientMap = new Map(
      tx
        .select()
        .from(ingredients)
        .all()
        .map((i) => [i.id, i]),
    );
    const pantryRows = tx.select().from(pantryItems).all();
    const pantry: PantryStock = new Map(pantryRows.map((p) => [p.ingredientId, p]));

    const { take, shortfall } = planConsumption(
      lines,
      ingredientMap,
      pantry,
      session.servings,
      session.choices,
    );
    for (const t of take) {
      const row = pantry.get(t.ingredientId)!;
      tx.update(pantryItems)
        .set({ quantity: afterTaking(row.quantity, t.amount, row.unit), updatedAt: now })
        .where(eq(pantryItems.ingredientId, t.ingredientId))
        .run();
    }

    const macros = recipeMacros(lines, ingredientMap, { choices: session.choices }).perServing;
    const perPortion = { kcal: roundKcal(macros.kcal), protein: roundProtein(macros.protein) };
    const eaten = options.eatNow ? 1 : 0;
    const stored = session.servings - eaten;

    if (stored > 0) {
      tx.insert(preparedPortions)
        .values({
          id: newId(),
          recipeId: recipe.id,
          cookSessionId: session.id,
          portionsLeft: stored,
          kcalPerPortion: perPortion.kcal,
          proteinPerPortion: perPortion.protein,
          cookedAt: now,
        })
        .run();
    }
    if (eaten > 0) {
      tx.insert(mealLogs)
        .values({
          id: newId(),
          timestamp: now,
          localDate: logicalDateAt(tx, now),
          mealType: options.mealType,
          source: 'recipe',
          recipeId: recipe.id,
          name: recipe.name,
          kcal: perPortion.kcal,
          protein: perPortion.protein,
          servings: 1,
          cookSessionId: session.id,
        })
        .run();
    }

    const previous = tx
      .select({ n: count() })
      .from(cookSessions)
      .where(
        and(
          eq(cookSessions.recipeId, recipe.id),
          isNotNull(cookSessions.finishedAt),
          isNull(cookSessions.undoneAt),
          ne(cookSessions.id, session.id),
        ),
      )
      .get();

    const finished = tx
      .update(cookSessions)
      .set({ finishedAt: now, pantryDelta: take, shortfall })
      .where(eq(cookSessions.id, session.id))
      .returning()
      .get();

    return resultOf(tx, finished, false, (previous?.n ?? 0) === 0);
  };

  return {
    start(
      recipeId: string,
      servings: number,
      choices: Record<string, string> = {},
      now: number = Date.now(),
    ) {
      return db.transaction((tx) => startIn(tx, recipeId, servings, choices, now));
    },

    /** The unfinished session to resume, if any. */
    getActive(): ActiveSession | undefined {
      const row = db
        .select({ session: cookSessions, recipeName: recipes.name })
        .from(cookSessions)
        .innerJoin(recipes, eq(recipes.id, cookSessions.recipeId))
        .where(and(isNull(cookSessions.finishedAt), isNull(cookSessions.abandonedAt)))
        .orderBy(desc(cookSessions.startedAt))
        .get();
      return row ? { ...row.session, recipeName: row.recipeName } : undefined;
    },

    get(id: string): CookSession | undefined {
      return getSession(db, id);
    },

    saveProgress(id: string, progress: CookProgress): void {
      db.update(cookSessions)
        .set({ progress })
        .where(and(eq(cookSessions.id, id), isNull(cookSessions.finishedAt)))
        .run();
    },

    abandon(id: string, now: number = Date.now()): void {
      db.update(cookSessions)
        .set({ abandonedAt: now })
        .where(and(eq(cookSessions.id, id), isNull(cookSessions.finishedAt)))
        .run();
    },

    /**
     * Finishes cooking atomically: pantry deduction (clamped at zero, shortfall recorded),
     * prepared portions and/or a meal log, and the session itself. Idempotent per session:
     * calling it again returns the first result without deducting twice.
     */
    finish(sessionId: string, options: FinishOptions, now: number = Date.now()): FinishResult {
      return db.transaction((tx) => finishIn(tx, sessionId, options, now));
    },

    /** «Просто съел(а)»: log and deduct without the cooking mode. */
    quickEat(
      recipeId: string,
      servings: number,
      choices: Record<string, string>,
      mealType: MealType,
      now: number = Date.now(),
    ): FinishResult {
      return db.transaction((tx) => {
        const session = startIn(tx, recipeId, servings, choices, now);
        return finishIn(tx, session.id, { eatNow: true, mealType }, now);
      });
    },

    /** What undo would do, for the confirmation dialog. */
    undoPreview(sessionId: string): UndoPreview {
      const session = getSession(db, sessionId);
      if (!session) return { canUndo: false, reason: 'not_found' };
      if (session.undoneAt !== null) return { canUndo: false, reason: 'already_undone' };
      if (session.finishedAt === null) return { canUndo: false, reason: 'not_finished' };
      const portion = db
        .select()
        .from(preparedPortions)
        .where(eq(preparedPortions.cookSessionId, sessionId))
        .get();
      if (portion) {
        const eaten = db
          .select({ n: count() })
          .from(mealLogs)
          .where(eq(mealLogs.portionId, portion.id))
          .get();
        if ((eaten?.n ?? 0) > 0) return { canUndo: false, reason: 'portions_eaten' };
      }
      return {
        canUndo: true,
        products: session.pantryDelta ?? [],
        portionsToRemove: portion?.portionsLeft ?? 0,
      };
    },

    /**
     * Undoes a finished cook: returns products to the pantry and removes its log and
     * portions. Refused once any stored portion has been eaten. Idempotent.
     */
    undo(sessionId: string, now: number = Date.now()): void {
      db.transaction((tx) => {
        const session = getSession(tx, sessionId);
        if (!session) throw new CookSessionError(`Cook session not found: ${sessionId}`);
        if (session.undoneAt !== null) return;
        if (session.finishedAt === null) throw new CookSessionError('Cook session is not finished');

        const portion = tx
          .select()
          .from(preparedPortions)
          .where(eq(preparedPortions.cookSessionId, sessionId))
          .get();
        if (portion) {
          const eatenFromPortion = tx
            .select({ n: count() })
            .from(mealLogs)
            .where(eq(mealLogs.portionId, portion.id))
            .get();
          if ((eatenFromPortion?.n ?? 0) > 0) {
            throw new CookSessionError('Portions from this cook were already eaten');
          }
        }

        for (const d of session.pantryDelta ?? []) {
          const row = tx
            .select()
            .from(pantryItems)
            .where(eq(pantryItems.ingredientId, d.ingredientId))
            .get();
          const quantity = normalizeQuantity((row?.quantity ?? 0) + d.amount, d.unit);
          tx.insert(pantryItems)
            .values({ ingredientId: d.ingredientId, quantity, unit: d.unit, updatedAt: now })
            .onConflictDoUpdate({
              target: pantryItems.ingredientId,
              set: { quantity, updatedAt: now },
            })
            .run();
        }
        tx.delete(mealLogs).where(eq(mealLogs.cookSessionId, sessionId)).run();
        tx.delete(preparedPortions).where(eq(preparedPortions.cookSessionId, sessionId)).run();
        tx.update(cookSessions).set({ undoneAt: now }).where(eq(cookSessions.id, sessionId)).run();
      });
    },
  };
}

export type CookRepo = ReturnType<typeof createCookRepo>;
