/**
 * @jest-environment node
 */
import { count, eq } from 'drizzle-orm';

import { appMeta, ingredients, recipeIngredients, recipes, recipeSteps } from '../schema';
import { SEED_INGREDIENTS } from '../seed/ingredients';
import { SEED_RECIPES } from '../seed/recipes';
import { runSeed, SEED_VERSION } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

const counts = (db: AppDb) => ({
  ingredients: db.select({ n: count() }).from(ingredients).get()?.n,
  recipes: db.select({ n: count() }).from(recipes).get()?.n,
  lines: db.select({ n: count() }).from(recipeIngredients).get()?.n,
  steps: db.select({ n: count() }).from(recipeSteps).get()?.n,
});

describe('seed data integrity', () => {
  const ingredientIds = new Set(SEED_INGREDIENTS.map((i) => i.id));

  it('has 16 recipes, 4 per meal type, with unique ids', () => {
    expect(new Set(SEED_RECIPES.map((r) => r.id)).size).toBe(16);
    for (const meal of ['breakfast', 'lunch', 'snack', 'dinner'] as const) {
      expect(SEED_RECIPES.filter((r) => r.mealType === meal)).toHaveLength(4);
    }
  });

  it('gives every piece-based ingredient a gramsPerPiece', () => {
    for (const i of SEED_INGREDIENTS.filter((x) => x.unit === 'pcs')) {
      expect({ id: i.id, g: i.gramsPerPiece }).toEqual({ id: i.id, g: expect.any(Number) });
    }
  });

  it.each(SEED_RECIPES.map((r) => [r.id, r] as const))('%s is internally consistent', (_, r) => {
    const lineIds = r.lines.map((l) => l.id);
    expect(new Set(lineIds).size).toBe(lineIds.length);
    lineIds.forEach((id) => expect(ingredientIds).toContain(id));
    r.steps.flatMap((s) => s.refs ?? []).forEach((ref) => expect(lineIds).toContain(ref));
    r.steps.forEach((s) => expect(s.timerMin === undefined || s.timerMin > 0).toBe(true));

    const groups = new Map<string, number>();
    r.lines.forEach((l) => l.alt && groups.set(l.alt, (groups.get(l.alt) ?? 0) + 1));
    groups.forEach((size) => expect(size).toBeGreaterThanOrEqual(2));
  });
});

describe('runSeed', () => {
  let db: AppDb;
  let close: () => void;

  beforeEach(() => {
    ({ db, close } = createTestDb());
  });
  afterEach(() => close());

  it('populates ingredients, recipes, lines and steps', () => {
    expect(runSeed(db)).toEqual({ applied: true });
    const c = counts(db);
    expect(c.ingredients).toBe(SEED_INGREDIENTS.length);
    expect(c.recipes).toBe(16);
    expect(c.lines).toBe(SEED_RECIPES.reduce((n, r) => n + r.lines.length, 0));
    expect(c.steps).toBe(SEED_RECIPES.reduce((n, r) => n + r.steps.length, 0));
    expect(db.select().from(appMeta).get()).toEqual({
      key: 'seed_version',
      value: String(SEED_VERSION),
    });
  });

  it('is idempotent: a second run is a no-op and duplicates nothing', () => {
    runSeed(db);
    const before = counts(db);
    expect(runSeed(db)).toEqual({ applied: false });
    expect(counts(db)).toEqual(before);
  });

  it('re-applying a seed version keeps user-edited ingredients and does not duplicate', () => {
    runSeed(db);
    const before = counts(db);
    db.update(ingredients).set({ kcalPer100g: 99 }).where(eq(ingredients.id, 'tvorog')).run();
    db.delete(appMeta).run(); // simulate an older seed version

    expect(runSeed(db)).toEqual({ applied: true });
    expect(counts(db)).toEqual(before);
    expect(
      db.select().from(ingredients).where(eq(ingredients.id, 'tvorog')).get()?.kcalPer100g,
    ).toBe(99);
  });

  it('sets batch defaults for lunches only and converts timers to seconds', () => {
    runSeed(db);
    const all = db.select().from(recipes).all();
    for (const r of all) {
      expect([r.id, r.isBatch, r.defaultServings]).toEqual(
        r.mealType === 'lunch' ? [r.id, true, 3] : [r.id, false, 1],
      );
    }
    const firstO1Timer = db
      .select()
      .from(recipeSteps)
      .where(eq(recipeSteps.recipeId, 'O1'))
      .all()
      .find((s) => s.order === 2);
    expect(firstO1Timer?.timerSec).toBe(360);
  });
});
