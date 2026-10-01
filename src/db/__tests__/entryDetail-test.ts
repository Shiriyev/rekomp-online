/**
 * @jest-environment node
 *
 * FIXES v1.1 task 4: editing an entry's time moves it between logical days; deleting a
 * cooked dish with its products can be undone.
 */
import { createRepositories, type Repositories } from '../repositories';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;

const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const NOW = local(2026, 10, 1, 12);
const snack = { name: 'Сникерс', kcal: 250, protein: 4, mealType: 'snack' } as const;

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
});
afterEach(() => close());

describe('editing the time', () => {
  it('re-derives the logical day and updates both days’ totals', () => {
    const log = repos.logs.addManual(snack, local(2026, 10, 1, 9));
    const moved = repos.logs.update(
      log.id,
      { ...snack, timestamp: local(2026, 10, 1, 1, 30) },
      NOW,
    );
    expect(moved.localDate).toBe('2026-09-30');
    expect(repos.logs.dayTotals('2026-10-01').kcal).toBe(0);
    expect(repos.logs.dayTotals('2026-09-30').kcal).toBe(250);

    const back = repos.logs.update(log.id, { ...snack, timestamp: local(2026, 10, 1, 4, 10) }, NOW);
    expect(back.localDate).toBe('2026-10-01');
  });

  it('keeps day and time when no new time is given', () => {
    const log = repos.logs.addManual(snack, local(2026, 10, 1, 9));
    const updated = repos.logs.update(log.id, { ...snack, kcal: 300 }, NOW);
    expect(updated).toMatchObject({
      kcal: 300,
      timestamp: log.timestamp,
      localDate: log.localDate,
    });
  });

  it('refuses a time in the future', () => {
    const log = repos.logs.addManual(snack, local(2026, 10, 1, 9));
    expect(() => repos.logs.update(log.id, { ...snack, timestamp: NOW + 3_600_000 }, NOW)).toThrow(
      RangeError,
    );
    expect(repos.logs.get(log.id)?.timestamp).toBe(log.timestamp);
  });
});

describe('cook redo (Undo of «удалить и вернуть»)', () => {
  it('takes the products again and restores the log and portions', () => {
    repos.pantry.setQuantity('chicken_breast', 1000, NOW);
    const s = repos.cook.start('O1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eatNow: true, mealType: 'lunch' }, NOW);
    const before = repos.pantry.get('chicken_breast')?.quantity;

    const undone = repos.cook.undo(s.id, NOW)!;
    expect(repos.pantry.get('chicken_breast')?.quantity).toBe(1000);
    expect(repos.cook.undo(s.id, NOW)).toBeNull();

    repos.cook.redo(undone, NOW);
    repos.cook.redo(undone, NOW); // idempotent
    expect(repos.pantry.get('chicken_breast')?.quantity).toBe(before);
    expect(repos.logs.get(r.logId!)).toBeDefined();
    expect(repos.portions.listAvailable()[0]?.portionsLeft).toBe(2);
    expect(repos.cook.get(s.id)?.undoneAt).toBeNull();
  });

  it('clamps when products were used meanwhile and records what was taken', () => {
    repos.pantry.setQuantity('yogurt_01', 500, NOW);
    repos.pantry.setQuantity('banana', 3, NOW);
    const r = repos.cook.quickEat('P4', 1, {}, 'snack', NOW);
    const undone = repos.cook.undo(r.sessionId, NOW)!;
    repos.pantry.setQuantity('yogurt_01', 100, NOW);

    repos.cook.redo(undone, NOW);
    expect(repos.pantry.get('yogurt_01')?.quantity).toBe(0);
    expect(repos.cook.get(r.sessionId)?.pantryDelta).toContainEqual({
      ingredientId: 'yogurt_01',
      amount: 100,
      unit: 'g',
    });
  });
});
