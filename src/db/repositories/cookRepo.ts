import { and, asc, count, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm';

import { afterTaking, planConsumption } from '../../domain/cooking';
import { recipeMacros, roundKcal, roundProtein } from '../../domain/nutrition';
import type { PantryStock } from '../../domain/pantry';
import {
  amountSnapshot,
  applyAmounts,
  sanitizeAmounts,
  usedAmounts,
} from '../../domain/recipeDraft';
import type { Macros, MealType } from '../../domain/types';
import { normalizeQuantity } from '../../domain/units';
import { newId } from '../../lib/id';
import { logicalDateAt } from '../logicalDay';
import { takeFromPantry } from '../pantryMoves';
import {
  cookSessions,
  ingredients,
  mealLogs,
  pantryItems,
  preparedPortions,
  recipeCustomAmounts,
  recipeIngredients,
  recipes,
  type CookProgress,
  type CookSession,
  type MealLog,
  type PreparedPortion,
} from '../schema';
import type { AppDb } from '../types';

export class CookSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CookSessionError';
  }
}

export const MAX_SERVINGS = 8;

/** `eaten`: portions eaten right away (0…servings); the rest go to «Готовые порции». */
export type FinishOptions = { eaten: number; mealType: MealType };

export type FinishResult = {
  sessionId: string;
  recipeId: string;
  /** Rounded per-portion macros (the log holds them × the portions eaten). */
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

/** What an undo removed, so the «Отменить» of a delete can put it back. */
export type UndoneCook = { sessionId: string; logs: MealLog[]; portions: PreparedPortion[] };

export type UndoPreview =
  | { canUndo: true; products: PantryDeltaItem[]; portionsToRemove: number }
  | { canUndo: false; reason: 'portions_eaten' | 'not_finished' | 'already_undone' | 'not_found' };

type PantryDeltaItem = { ingredientId: string; amount: number; unit: 'g' | 'ml' | 'pcs' };

const validateServings = (servings: number) => {
  if (!Number.isInteger(servings) || servings < 1 || servings > MAX_SERVINGS) {
    throw new RangeError(`servings must be an integer 1–${MAX_SERVINGS}, got ${servings}`);
  }
};

/** Recipe lines with «моя версия» amounts applied (the card's starting point). */
export function effectiveLines(tx: AppDb, recipeId: string) {
  const lines = tx
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.sortOrder))
    .all();
  const custom = tx
    .select()
    .from(recipeCustomAmounts)
    .where(eq(recipeCustomAmounts.recipeId, recipeId))
    .all();
  return applyAmounts(
    lines,
    Object.fromEntries(custom.map((c) => [c.ingredientId, c.amountPerServing])),
  );
}

export function createCookRepo(db: AppDb) {
  const getSession = (tx: AppDb, id: string) =>
    tx.select().from(cookSessions).where(eq(cookSessions.id, id)).get();

  /** Full per-serving snapshot: recipe (with «моя версия») plus the card's draft. */
  const snapshotFor = (tx: AppDb, recipeId: string, amounts: Readonly<Record<string, unknown>>) => {
    const lines = effectiveLines(tx, recipeId);
    return amountSnapshot(applyAmounts(lines, sanitizeAmounts(amounts, lines)));
  };

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
    const eaten = log?.servings ?? 0;
    const perPortion = portion
      ? { kcal: portion.kcalPerPortion, protein: portion.proteinPerPortion }
      : {
          kcal: log ? roundKcal(log.kcal / eaten) : 0,
          protein: log ? roundProtein(log.protein / eaten) : 0,
        };
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
    amounts: Readonly<Record<string, number>>,
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
      .values({
        id: newId(),
        recipeId,
        servings,
        choices,
        startedAt: now,
        amountOverrides: snapshotFor(tx, recipeId, amounts),
      })
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
    if (!Number.isInteger(options.eaten) || options.eaten < 0 || options.eaten > session.servings) {
      throw new RangeError(`eaten must be an integer 0–${session.servings}, got ${options.eaten}`);
    }

    const recipe = tx.select().from(recipes).where(eq(recipes.id, session.recipeId)).get();
    if (!recipe) throw new CookSessionError(`Recipe not found: ${session.recipeId}`);
    // The amounts captured when cooking started (edited on the card), not today's recipe.
    const lines = applyAmounts(effectiveLines(tx, recipe.id), session.amountOverrides);
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
    const eaten = options.eaten;
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
          storageDays: recipe.storageDays,
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
          kcal: perPortion.kcal * eaten,
          protein: roundProtein(perPortion.protein * eaten),
          servings: eaten,
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
      .set({
        finishedAt: now,
        pantryDelta: take,
        shortfall,
        usedAmounts: usedAmounts(lines, ingredientMap, session.servings, session.choices),
      })
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
      /** Per-serving amounts edited on the card (draft); missing ids keep the recipe's. */
      amounts: Readonly<Record<string, number>> = {},
    ) {
      return db.transaction((tx) => startIn(tx, recipeId, servings, choices, now, amounts));
    },

    /**
     * The card's draft (and servings, when given) changed while this recipe was already
     * being cooked: the running cook follows the card.
     */
    setAmounts(
      id: string,
      amounts: Readonly<Record<string, number>>,
      servings?: number,
    ): CookSession | undefined {
      if (servings !== undefined) validateServings(servings);
      return db.transaction((tx) => {
        const session = getSession(tx, id);
        if (!session || session.finishedAt !== null || session.abandonedAt !== null) return session;
        return tx
          .update(cookSessions)
          .set({
            amountOverrides: snapshotFor(tx, session.recipeId, amounts),
            ...(servings === undefined ? {} : { servings }),
          })
          .where(eq(cookSessions.id, id))
          .returning()
          .get();
      });
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
      amounts: Readonly<Record<string, number>> = {},
    ): FinishResult {
      return db.transaction((tx) => {
        const session = startIn(tx, recipeId, servings, choices, now, amounts);
        return finishIn(tx, session.id, { eaten: 1, mealType }, now);
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
     * portions. Refused once any stored portion has been eaten. Idempotent (null when it
     * was already undone). Returns what was removed, for `redo`.
     */
    undo(sessionId: string, now: number = Date.now()): UndoneCook | null {
      return db.transaction((tx) => {
        const session = getSession(tx, sessionId);
        if (!session) throw new CookSessionError(`Cook session not found: ${sessionId}`);
        if (session.undoneAt !== null) return null;
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
        const logs = tx.select().from(mealLogs).where(eq(mealLogs.cookSessionId, sessionId)).all();
        const portions = tx
          .select()
          .from(preparedPortions)
          .where(eq(preparedPortions.cookSessionId, sessionId))
          .all();
        tx.delete(mealLogs).where(eq(mealLogs.cookSessionId, sessionId)).run();
        tx.delete(preparedPortions).where(eq(preparedPortions.cookSessionId, sessionId)).run();
        tx.update(cookSessions).set({ undoneAt: now }).where(eq(cookSessions.id, sessionId)).run();
        return { sessionId, logs, portions };
      });
    },

    /**
     * Reverses `undo` (the «Отменить» right after deleting a cooked dish): takes the products
     * again (clamped at zero; the session then records what was really taken) and puts the
     * log and portions back. No-op unless the session is currently undone.
     */
    redo(undone: UndoneCook, now: number = Date.now()): void {
      db.transaction((tx) => {
        const session = getSession(tx, undone.sessionId);
        if (!session || session.undoneAt === null) return;
        const taken = takeFromPantry(tx, session.pantryDelta ?? [], now);
        for (const p of undone.portions) tx.insert(preparedPortions).values(p).run();
        for (const l of undone.logs) tx.insert(mealLogs).values(l).run();
        tx.update(cookSessions)
          .set({ undoneAt: null, pantryDelta: taken })
          .where(eq(cookSessions.id, session.id))
          .run();
      });
    },
  };
}

export type CookRepo = ReturnType<typeof createCookRepo>;
