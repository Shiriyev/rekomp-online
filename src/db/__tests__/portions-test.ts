/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';

import { createRepositories, type Repositories } from '../repositories';
import { NoPortionsLeftError } from '../repositories/portionsRepo';
import { mealLogs, preparedPortions } from '../schema';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;

const addPortion = (id: string, portionsLeft: number, cookedAt = 1) =>
  db
    .insert(preparedPortions)
    .values({
      id,
      recipeId: 'O1',
      portionsLeft,
      kcalPerPortion: 709,
      proteinPerPortion: 61.4,
      cookedAt,
    })
    .run();

const left = (id: string) =>
  db.select().from(preparedPortions).where(eq(preparedPortions.id, id)).get()?.portionsLeft;

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
});
afterEach(() => close());

describe('portionsRepo', () => {
  it('lists non-empty containers oldest first with the recipe name', () => {
    addPortion('new', 2, 200);
    addPortion('old', 1, 100);
    addPortion('empty', 0, 50);
    expect(repos.portions.listAvailable().map((p) => [p.id, p.recipeName])).toEqual([
      ['old', 'Курица с рисом и овощами (как плов)'],
      ['new', 'Курица с рисом и овощами (как плов)'],
    ]);
  });

  it('eats a portion: decrements and logs with the stored macros', () => {
    addPortion('p', 3);
    const log = repos.portions.eat('p', 'lunch', Date.UTC(2026, 8, 27, 11));
    expect(left('p')).toBe(2);
    expect(log).toMatchObject({
      source: 'portion',
      recipeId: 'O1',
      portionId: 'p',
      kcal: 709,
      protein: 61.4,
      mealType: 'lunch',
      localDate: '2026-09-27',
    });
  });

  it('refuses to eat from an empty or unknown container without side effects', () => {
    addPortion('p', 0);
    expect(() => repos.portions.eat('p', 'lunch')).toThrow(NoPortionsLeftError);
    expect(() => repos.portions.eat('ghost', 'lunch')).toThrow(NoPortionsLeftError);
    expect(db.select().from(mealLogs).all()).toEqual([]);
  });
});

describe('logRepo.undo', () => {
  it('removes a manual entry', () => {
    const log = repos.logs.addManual({ name: 'Сникерс', kcal: 250, protein: 4, mealType: 'snack' });
    repos.logs.undo(log.id);
    expect(db.select().from(mealLogs).all()).toEqual([]);
  });

  it('puts an eaten portion back', () => {
    addPortion('p', 1);
    const log = repos.portions.eat('p', 'lunch');
    expect(left('p')).toBe(0);
    repos.logs.undo(log.id);
    expect(left('p')).toBe(1);
    expect(db.select().from(mealLogs).all()).toEqual([]);
  });

  it('is idempotent: a second undo changes nothing', () => {
    addPortion('p', 2);
    const log = repos.portions.eat('p', 'lunch');
    repos.logs.undo(log.id);
    repos.logs.undo(log.id);
    expect(left('p')).toBe(2);
  });
});

describe('logRepo.recentManual', () => {
  it('returns manual entries newest first, excluding other sources', () => {
    addPortion('p', 1);
    repos.logs.addManual({ name: 'A', kcal: 1, protein: 1, mealType: 'snack' }, 1000);
    repos.logs.addManual({ name: 'B', kcal: 1, protein: 1, mealType: 'snack' }, 2000);
    repos.portions.eat('p', 'lunch', 3000);
    expect(repos.logs.recentManual().map((l) => l.name)).toEqual(['B', 'A']);
  });
});
