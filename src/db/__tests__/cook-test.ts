/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';

import { createRepositories, type Repositories } from '../repositories';
import { CookSessionError } from '../repositories/cookRepo';
import { cookSessions, mealLogs, preparedPortions } from '../schema';
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
    const r = repos.cook.finish(s.id, { eatNow: true, mealType: 'lunch' }, NOW);

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

  it('stores every portion when not eating now', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eatNow: false, mealType: 'lunch' }, NOW);
    expect(r).toMatchObject({ eaten: 0, stored: 3, logId: null });
    expect(portions()[0]?.portionsLeft).toBe(3);
    expect(logs()).toEqual([]);
  });

  it('clamps pantry at zero and records the shortfall', () => {
    repos.pantry.setQuantity('chicken_breast', 300);
    const s = repos.cook.start('O1', 3, {}, NOW);
    repos.cook.finish(s.id, { eatNow: true, mealType: 'lunch' }, NOW);

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
    const first = repos.cook.finish(s.id, { eatNow: true, mealType: 'lunch' }, NOW);
    const second = repos.cook.finish(s.id, { eatNow: false, mealType: 'dinner' }, NOW + 5000);

    expect(second).toEqual({ ...first, firstTime: false, alreadyFinished: true });
    expect(qty('chicken_breast')).toBe(340);
    expect(logs()).toHaveLength(1);
    expect(portions()).toHaveLength(1);
  });

  it('uses the chosen alternative stored on the session', () => {
    repos.pantry.setQuantity('greek_yogurt', 200);
    repos.pantry.setQuantity('skyr', 200);
    const s = repos.cook.start('P1', 1, { yogurt: 'greek_yogurt' }, NOW);
    repos.cook.finish(s.id, { eatNow: true, mealType: 'snack' }, NOW);
    expect([qty('greek_yogurt'), qty('skyr')]).toEqual([50, 200]);
  });

  it('refuses abandoned, undone or unknown sessions', () => {
    const s = repos.cook.start('P1', 1, {}, NOW);
    repos.cook.abandon(s.id, NOW);
    expect(() => repos.cook.finish(s.id, { eatNow: true, mealType: 'snack' })).toThrow(
      CookSessionError,
    );
    expect(() => repos.cook.finish('ghost', { eatNow: true, mealType: 'snack' })).toThrow(
      CookSessionError,
    );
  });

  it('marks only the first successful cook of a recipe as first time', () => {
    const a = repos.cook.start('P4', 1, {}, NOW);
    expect(repos.cook.finish(a.id, { eatNow: true, mealType: 'snack' }, NOW).firstTime).toBe(true);
    const b = repos.cook.start('P4', 1, {}, NOW + 1);
    expect(repos.cook.finish(b.id, { eatNow: true, mealType: 'snack' }, NOW + 1).firstTime).toBe(
      false,
    );
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

    repos.cook.finish(b.id, { eatNow: true, mealType: 'breakfast' }, NOW + 2);
    expect(repos.cook.getActive()).toBeUndefined();
  });
});

describe('cookRepo.undo', () => {
  it('returns products exactly and removes the log and portions', () => {
    stockO1();
    repos.pantry.setQuantity('chicken_breast', 300); // partially short
    const s = repos.cook.start('O1', 3, {}, NOW);
    repos.cook.finish(s.id, { eatNow: true, mealType: 'lunch' }, NOW);
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
    repos.cook.finish(s.id, { eatNow: true, mealType: 'snack' }, NOW);
    repos.pantry.remove('apple');
    repos.cook.undo(s.id, NOW);
    expect(qty('apple')).toBe(1);
  });

  it('is idempotent', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    repos.cook.finish(s.id, { eatNow: true, mealType: 'lunch' }, NOW);
    repos.cook.undo(s.id, NOW);
    repos.cook.undo(s.id, NOW);
    expect(qty('chicken_breast')).toBe(1000);
  });

  it('refuses once a stored portion has been eaten, leaving everything intact', () => {
    stockO1();
    const s = repos.cook.start('O1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eatNow: false, mealType: 'lunch' }, NOW);
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
