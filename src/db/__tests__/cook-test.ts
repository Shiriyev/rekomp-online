/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';

import { AUTO_GROUP_PREFIX } from '../../domain/substitutions';
import { createRepositories, type Repositories } from '../repositories';
import { CookSessionError } from '../repositories/cookRepo';
import { cookSessions, mealLogs, preparedPortions, recipes } from '../schema';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;

const NOW = Date.UTC(2026, 8, 27, 11, 0);
const qty = (id: string) => repos.pantry.get(id)?.quantity;
const logs = () => db.select().from(mealLogs).all();
const portions = () => db.select().from(preparedPortions).all();

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
});
afterEach(() => close());

/** O1 per serving: chicken 220, rice 100, veg_frozen 150, oil 5 (+ staples). */
const stockO1 = () => {
  repos.pantry.setQuantity('chicken_breast', 1000);
  repos.pantry.setQuantity('rice', 500);
  repos.pantry.setQuantity('veg_frozen', 1000);
  repos.pantry.setQuantity('oil', 500);
};

describe('cookRepo.finish', () => {
  it('deducts ingredients × servings, stores portions and logs one eaten portion atomically', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eaten: 1, mealType: 'lunch' }, NOW);

    expect([qty('chicken_breast'), qty('rice'), qty('veg_frozen'), qty('oil')]).toEqual([
      340, 200, 550, 485,
    ]);
    expect(r).toMatchObject({
      servings: 3,
      eaten: 1,
      stored: 2,
      firstTime: true,
      alreadyFinished: false,
    });
    expect(r.perPortion).toEqual({ kcal: 709, protein: 61.4 });

    expect(portions()).toEqual([
      expect.objectContaining({ portionsLeft: 2, cookSessionId: s.id, kcalPerPortion: 709 }),
    ]);
    expect(logs()).toEqual([
      expect.objectContaining({
        source: 'recipe',
        recipeId: 'O1',
        cookSessionId: s.id,
        kcal: 709,
        mealType: 'lunch',
      }),
    ]);
    const session = repos.cook.get(s.id)!;
    expect(session.finishedAt).toBe(NOW);
    expect(session.shortfall).toEqual([]);
  });

  it('logs N eaten portions as one entry and stores the rest', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eaten: 2, mealType: 'lunch' }, NOW);
    expect(r).toMatchObject({ eaten: 2, stored: 1, perPortion: { kcal: 709, protein: 61.4 } });
    expect(logs()).toEqual([expect.objectContaining({ servings: 2, kcal: 1418, protein: 122.8 })]);
    expect(portions()).toEqual([expect.objectContaining({ portionsLeft: 1, storageDays: 3 })]);
    // A retry returns the same result.
    expect(repos.cook.finish(s.id, { eaten: 0, mealType: 'lunch' }, NOW)).toMatchObject({
      eaten: 2,
      stored: 1,
      alreadyFinished: true,
    });
  });

  it('eats every portion without storing any', () => {
    stockO1();
    const s = repos.cook.start('O1', 2, {}, NOW);
    const r = repos.cook.finish(s.id, { eaten: 2, mealType: 'lunch' }, NOW);
    expect(r).toMatchObject({ eaten: 2, stored: 0, portionId: null, perPortion: { kcal: 709 } });
    expect(portions()).toEqual([]);
  });

  it('cooks a breakfast for 3: deducts ×3, logs 1, stores 2 with its storage days', () => {
    repos.pantry.setQuantity('tvorog', 1000);
    db.update(recipes).set({ storageDays: 1 }).where(eq(recipes.id, 'Z1')).run();
    const s = repos.cook.start('Z1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eaten: 1, mealType: 'breakfast' }, NOW);
    expect(qty('tvorog')).toBe(250);
    expect(r).toMatchObject({ eaten: 1, stored: 2 });
    expect(portions()).toEqual([
      expect.objectContaining({ recipeId: 'Z1', portionsLeft: 2, storageDays: 1 }),
    ]);
    expect(repos.cook.get(s.id)?.usedAmounts).toContainEqual({
      ingredientId: 'tvorog',
      amount: 750,
      unit: 'g',
    });
  });

  it('rejects an eaten count outside 0…servings', () => {
    stockO1();
    const s = repos.cook.start('O1', 2, {}, NOW);
    expect(() => repos.cook.finish(s.id, { eaten: 3, mealType: 'lunch' }, NOW)).toThrow(RangeError);
    expect(() => repos.cook.finish(s.id, { eaten: -1, mealType: 'lunch' }, NOW)).toThrow(
      RangeError,
    );
    expect(() => repos.cook.finish(s.id, { eaten: 0.5, mealType: 'lunch' }, NOW)).toThrow(
      RangeError,
    );
    expect(repos.cook.get(s.id)?.finishedAt).toBeNull();
  });

  it('stores every portion when not eating now', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eaten: 0, mealType: 'lunch' }, NOW);
    expect(r).toMatchObject({ eaten: 0, stored: 3, logId: null });
    expect(portions()[0]?.portionsLeft).toBe(3);
    expect(logs()).toEqual([]);
  });

  it('clamps pantry at zero and records the shortfall', () => {
    repos.pantry.setQuantity('chicken_breast', 300);
    const s = repos.cook.start('O1', 3, {}, NOW);
    repos.cook.finish(s.id, { eaten: 1, mealType: 'lunch' }, NOW);

    expect(qty('chicken_breast')).toBe(0);
    const session = repos.cook.get(s.id)!;
    expect(session.pantryDelta).toEqual([
      { ingredientId: 'chicken_breast', amount: 300, unit: 'g' },
    ]);
    expect(session.shortfall).toEqual([
      { ingredientId: 'chicken_breast', amount: 360, unit: 'g' },
      { ingredientId: 'rice', amount: 300, unit: 'g' },
      { ingredientId: 'veg_frozen', amount: 450, unit: 'g' },
      { ingredientId: 'oil', amount: 15, unit: 'g' },
    ]);
  });

  it('is idempotent: finishing again does not deduct or log twice', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    const first = repos.cook.finish(s.id, { eaten: 1, mealType: 'lunch' }, NOW);
    const second = repos.cook.finish(s.id, { eaten: 0, mealType: 'dinner' }, NOW + 5000);

    expect(second).toEqual({ ...first, firstTime: false, alreadyFinished: true });
    expect(qty('chicken_breast')).toBe(340);
    expect(logs()).toHaveLength(1);
    expect(portions()).toHaveLength(1);
  });

  it('uses the chosen alternative stored on the session', () => {
    repos.pantry.setQuantity('greek_yogurt', 200);
    repos.pantry.setQuantity('skyr', 200);
    const s = repos.cook.start('P1', 1, { yogurt: 'greek_yogurt' }, NOW);
    repos.cook.finish(s.id, { eaten: 1, mealType: 'snack' }, NOW);
    expect([qty('greek_yogurt'), qty('skyr')]).toEqual([50, 200]);
  });

  it('deducts a global stand-in rather than the product the recipe names', () => {
    repos.pantry.setQuantity('tvorog', 500);
    repos.pantry.setQuantity('skyr', 500);
    // Z1 names tvorog and carries no alternative of its own: skyr stands in only through
    // the global rules, so the group is on no stored line. Were the lines not expanded for
    // the cook as well, this would quietly take the tvorog the recipe asked for.
    const s = repos.cook.start('Z1', 1, { [`${AUTO_GROUP_PREFIX}tvorog`]: 'skyr' }, NOW);
    repos.cook.finish(s.id, { eaten: 1, mealType: 'breakfast' }, NOW);
    expect([qty('skyr'), qty('tvorog')]).toEqual([250, 500]);
  });

  it('refuses abandoned, undone or unknown sessions', () => {
    const s = repos.cook.start('P1', 1, {}, NOW);
    repos.cook.abandon(s.id, NOW);
    expect(() => repos.cook.finish(s.id, { eaten: 1, mealType: 'snack' })).toThrow(
      CookSessionError,
    );
    expect(() => repos.cook.finish('ghost', { eaten: 1, mealType: 'snack' })).toThrow(
      CookSessionError,
    );
  });

  it('marks only the first successful cook of a recipe as first time', () => {
    const a = repos.cook.start('P4', 1, {}, NOW);
    expect(repos.cook.finish(a.id, { eaten: 1, mealType: 'snack' }, NOW).firstTime).toBe(true);
    const b = repos.cook.start('P4', 1, {}, NOW + 1);
    expect(repos.cook.finish(b.id, { eaten: 1, mealType: 'snack' }, NOW + 1).firstTime).toBe(false);
  });
});

describe('cookRepo.start / getActive', () => {
  it('validates input', () => {
    expect(() => repos.cook.start('O1', 0)).toThrow(RangeError);
    expect(() => repos.cook.start('O1', 1.5)).toThrow(RangeError);
    expect(() => repos.cook.start('nope', 1)).toThrow(CookSessionError);
  });

  it('keeps a single active session to resume, with saved progress', () => {
    const a = repos.cook.start('Z1', 1, {}, NOW);
    repos.cook.saveProgress(a.id, { stepIndex: 2, checked: ['tvorog'], timers: [] });
    expect(repos.cook.getActive()).toMatchObject({
      id: a.id,
      recipeName: 'Творог с ягодами и овсянкой',
    });
    expect(repos.cook.getActive()?.progress).toEqual({
      stepIndex: 2,
      checked: ['tvorog'],
      timers: [],
    });

    const b = repos.cook.start('Z2', 1, {}, NOW + 1);
    expect(repos.cook.getActive()?.id).toBe(b.id);
    expect(repos.cook.get(a.id)?.abandonedAt).toBe(NOW + 1);

    repos.cook.finish(b.id, { eaten: 1, mealType: 'breakfast' }, NOW + 2);
    expect(repos.cook.getActive()).toBeUndefined();
  });
});

describe('cookRepo.undo', () => {
  it('returns products exactly and removes the log and portions', () => {
    stockO1();
    repos.pantry.setQuantity('chicken_breast', 300); // partially short
    const s = repos.cook.start('O1', 3, {}, NOW);
    repos.cook.finish(s.id, { eaten: 1, mealType: 'lunch' }, NOW);
    repos.cook.undo(s.id, NOW + 1000);

    expect([qty('chicken_breast'), qty('rice'), qty('veg_frozen'), qty('oil')]).toEqual([
      300, 500, 1000, 500,
    ]);
    expect(logs()).toEqual([]);
    expect(portions()).toEqual([]);
    expect(repos.cook.get(s.id)?.undoneAt).toBe(NOW + 1000);
  });

  it('recreates pantry rows removed after cooking', () => {
    repos.pantry.setQuantity('apple', 1);
    repos.pantry.setQuantity('skyr', 150);
    const s = repos.cook.start('P1', 1, {}, NOW);
    repos.cook.finish(s.id, { eaten: 1, mealType: 'snack' }, NOW);
    repos.pantry.remove('apple');
    repos.cook.undo(s.id, NOW);
    expect(qty('apple')).toBe(1);
  });

  it('is idempotent', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    repos.cook.finish(s.id, { eaten: 1, mealType: 'lunch' }, NOW);
    repos.cook.undo(s.id, NOW);
    repos.cook.undo(s.id, NOW);
    expect(qty('chicken_breast')).toBe(1000);
  });

  it('refuses once a stored portion has been eaten, leaving everything intact', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eaten: 0, mealType: 'lunch' }, NOW);
    repos.portions.eat(r.portionId!, 'lunch', NOW + 1);

    expect(() => repos.cook.undo(s.id)).toThrow('already eaten');
    expect(qty('chicken_breast')).toBe(340);
    expect(portions()[0]?.portionsLeft).toBe(2);
  });

  it('refuses unfinished and unknown sessions', () => {
    const s = repos.cook.start('P1', 1, {}, NOW);
    expect(() => repos.cook.undo(s.id)).toThrow('not finished');
    expect(() => repos.cook.undo('ghost')).toThrow(CookSessionError);
  });
});

describe('cookRepo.quickEat', () => {
  it('logs and deducts for one serving in a single step', () => {
    repos.pantry.setQuantity('yogurt_01', 500);
    repos.pantry.setQuantity('banana', 3);
    const r = repos.cook.quickEat('P4', 1, {}, 'snack', NOW);
    expect([qty('yogurt_01'), qty('banana')]).toEqual([325, 2]);
    expect(r).toMatchObject({ eaten: 1, stored: 0, portionId: null });
    const session = db.select().from(cookSessions).where(eq(cookSessions.id, r.sessionId)).get();
    expect(session?.finishedAt).toBe(NOW);
    expect(repos.cook.getActive()).toBeUndefined();
  });
});
