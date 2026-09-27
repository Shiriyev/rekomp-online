import { eq, inArray } from 'drizzle-orm';

import { appMeta, ingredients, recipeIngredients, recipes, recipeSteps } from '../schema';
import type { AppDb } from '../types';
import { SEED_INGREDIENTS } from './ingredients';
import { SEED_RECIPES, type SeedRecipe } from './recipes';

/**
 * Bump when seed content changes; recipes are re-synced, user-edited ingredients are kept.
 * v2: U4 shakshuka uses 1 slice of bread (was 2) to match the reference ~470 kcal.
 */
export const SEED_VERSION = 2;
const SEED_VERSION_KEY = 'seed_version';

const LUNCH_DEFAULTS = { defaultServings: 3, isBatch: true } as const;
const SINGLE_DEFAULTS = { defaultServings: 1, isBatch: false } as const;

const unitOf = new Map(SEED_INGREDIENTS.map((i) => [i.id, i.unit]));

function recipeRow(r: SeedRecipe, sortOrder: number) {
  return {
    id: r.id,
    name: r.name,
    mealType: r.mealType,
    ...(r.mealType === 'lunch' ? LUNCH_DEFAULTS : SINGLE_DEFAULTS),
    prepNightBefore: r.prepNightBefore ?? false,
    totalMinutes: r.totalMinutes,
    imageKey: r.id.toLowerCase(),
    tags: r.tags ?? [],
    sortOrder,
  };
}

function lineRows(r: SeedRecipe) {
  return r.lines.map((line, sortOrder) => {
    const unit = line.unit ?? unitOf.get(line.id);
    if (!unit) throw new Error(`Seed recipe ${r.id} references unknown ingredient ${line.id}`);
    return {
      recipeId: r.id,
      ingredientId: line.id,
      amountPerServing: line.amount,
      unit,
      optional: line.optional ?? false,
      altGroup: line.alt ?? null,
      sortOrder,
      note: line.note ?? null,
    };
  });
}

function stepRows(r: SeedRecipe) {
  return r.steps.map((step, i) => ({
    recipeId: r.id,
    order: i + 1,
    text: step.text,
    timerSec: step.timerMin === undefined ? null : Math.round(step.timerMin * 60),
    ingredientRefs: step.refs ?? [],
  }));
}

/**
 * Idempotent seed. Safe to call on every app start: it is a no-op once the current
 * SEED_VERSION is applied, and never duplicates or overwrites user-edited ingredients.
 */
export function runSeed(db: AppDb): { applied: boolean } {
  return db.transaction((tx) => {
    const current = tx.select().from(appMeta).where(eq(appMeta.key, SEED_VERSION_KEY)).get();
    if (current && Number(current.value) >= SEED_VERSION) return { applied: false };

    tx.insert(ingredients).values(SEED_INGREDIENTS).onConflictDoNothing().run();

    const recipeIds = SEED_RECIPES.map((r) => r.id);
    tx.delete(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds)).run();
    tx.delete(recipeSteps).where(inArray(recipeSteps.recipeId, recipeIds)).run();

    SEED_RECIPES.forEach((r, index) => {
      const row = recipeRow(r, index);
      tx.insert(recipes).values(row).onConflictDoUpdate({ target: recipes.id, set: row }).run();
      tx.insert(recipeIngredients).values(lineRows(r)).run();
      tx.insert(recipeSteps).values(stepRows(r)).run();
    });

    const value = String(SEED_VERSION);
    tx.insert(appMeta)
      .values({ key: SEED_VERSION_KEY, value })
      .onConflictDoUpdate({ target: appMeta.key, set: { value } })
      .run();

    return { applied: true };
  });
}
