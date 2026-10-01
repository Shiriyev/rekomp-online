/**
 * @jest-environment node
 */
import { ZodError } from 'zod';

import { createRepositories, type Repositories } from '../repositories';
import { mealLogs } from '../schema';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;
const NOW = Date.UTC(2026, 8, 27, 10);

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
});
afterEach(() => close());

describe('logRepo editing', () => {
  it('updates a manual entry', () => {
    const log = repos.logs.addManual(
      { name: 'Ль', kcal: 5000, protein: 15, mealType: 'snack' },
      NOW,
    );
    const updated = repos.logs.update(log.id, {
      name: 'Латте',
      kcal: 150,
      protein: 8,
      mealType: 'breakfast',
    });
    expect(updated).toMatchObject({
      name: 'Латте',
      kcal: 150,
      protein: 8,
      mealType: 'breakfast',
      localDate: log.localDate,
    });
  });

  it('keeps the dish name on cooked entries', () => {
    const r = repos.cook.quickEat('P4', 1, {}, 'snack', NOW);
    const updated = repos.logs.update(r.logId!, {
      name: 'другое',
      kcal: 200,
      protein: 10,
      mealType: 'dinner',
    });
    expect(updated).toMatchObject({ name: 'Йогурт + банан', kcal: 200, mealType: 'dinner' });
  });

  it('validates and reports unknown entries', () => {
    const log = repos.logs.addManual({ name: 'A', kcal: 1, protein: 1, mealType: 'snack' });
    expect(() =>
      repos.logs.update(log.id, { name: '', kcal: 1, protein: 1, mealType: 'snack' }),
    ).toThrow(ZodError);
    expect(() =>
      repos.logs.update('ghost', { name: 'A', kcal: 1, protein: 1, mealType: 'snack' }),
    ).toThrow('not found');
  });

  it('finds the latest entry', () => {
    repos.logs.addManual({ name: 'A', kcal: 1, protein: 1, mealType: 'snack' }, NOW);
    repos.logs.addManual({ name: 'B', kcal: 1, protein: 1, mealType: 'snack' }, NOW + 1000);
    expect(repos.logs.latest()?.name).toBe('B');
  });
});

describe('deleting a cooked entry (phase 7 DoD)', () => {
  const stock = () => {
    repos.pantry.setQuantity('yogurt_01', 500);
    repos.pantry.setQuantity('banana', 3);
  };

  it('previews what undo returns and removes', () => {
    stock();
    const r = repos.cook.quickEat('P4', 1, {}, 'snack', NOW);
    expect(repos.cook.undoPreview(r.sessionId)).toEqual({
      canUndo: true,
      products: [
        { ingredientId: 'yogurt_01', amount: 175, unit: 'g' },
        { ingredientId: 'banana', amount: 1, unit: 'pcs' },
      ],
      portionsToRemove: 0,
    });
  });

  it('«удалить и вернуть продукты» restores the pantry', () => {
    stock();
    const r = repos.cook.quickEat('P4', 1, {}, 'snack', NOW);
    repos.cook.undo(r.sessionId);
    expect([repos.pantry.get('yogurt_01')?.quantity, repos.pantry.get('banana')?.quantity]).toEqual(
      [500, 3],
    );
    expect(db.select().from(mealLogs).all()).toEqual([]);
  });

  it('«только удалить запись» keeps the pantry deducted', () => {
    stock();
    const r = repos.cook.quickEat('P4', 1, {}, 'snack', NOW);
    repos.logs.removeEntryOnly(r.logId!);
    expect(repos.pantry.get('yogurt_01')?.quantity).toBe(325);
    expect(db.select().from(mealLogs).all()).toEqual([]);
  });

  it('removeEntryOnly ignores portion entries (they must give the portion back)', () => {
    const s = repos.cook.start('O1', 2, {}, NOW);
    const { portionId } = repos.cook.finish(s.id, { eatNow: false, mealType: 'lunch' }, NOW);
    const eaten = repos.portions.eat(portionId!, 'lunch', NOW);
    repos.logs.removeEntryOnly(eaten.id);
    expect(repos.logs.get(eaten.id)).toBeDefined();
  });

  it('refuses the product return once portions from the pot were eaten', () => {
    const s = repos.cook.start('O1', 3, {}, NOW);
    const r = repos.cook.finish(s.id, { eatNow: true, mealType: 'lunch' }, NOW);
    expect(repos.cook.undoPreview(s.id)).toMatchObject({ canUndo: true, portionsToRemove: 2 });
    repos.portions.eat(r.portionId!, 'lunch', NOW + 1);
    expect(repos.cook.undoPreview(s.id)).toEqual({ canUndo: false, reason: 'portions_eaten' });
  });

  it('reports sessions that cannot be undone', () => {
    const s = repos.cook.start('P4', 1, {}, NOW);
    expect(repos.cook.undoPreview(s.id)).toEqual({ canUndo: false, reason: 'not_finished' });
    repos.cook.finish(s.id, { eatNow: true, mealType: 'snack' }, NOW);
    repos.cook.undo(s.id);
    expect(repos.cook.undoPreview(s.id)).toEqual({ canUndo: false, reason: 'already_undone' });
    expect(repos.cook.undoPreview('ghost')).toEqual({ canUndo: false, reason: 'not_found' });
  });
});
