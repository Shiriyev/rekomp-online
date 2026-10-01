/**
 * @jest-environment node
 *
 * FIXES v1.1 task 3: a manual entry can take products from «Дома» in the same transaction.
 */
import { createRepositories, type Repositories } from '../repositories';
import { mealLogs } from '../schema';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;
const NOW = Date.UTC(2026, 8, 27, 10);
const ID = '7f1f9b8e-0000-4000-8000-000000000001';

const entry = (deductions?: { ingredientId: string; amount: number }[], id?: string) => ({
  id,
  name: 'Творог 150 г',
  kcal: 195,
  protein: 25.5,
  mealType: 'snack' as const,
  deductions,
});

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
  repos.pantry.setQuantity('tvorog', 350, NOW);
  repos.pantry.setQuantity('banana', 2, NOW);
});
afterEach(() => close());

const qty = (id: string) => repos.pantry.get(id)?.quantity;

describe('addManual with deductions', () => {
  it('takes several products and stores exactly what was taken', () => {
    const log = repos.logs.addManual(
      entry([
        { ingredientId: 'tvorog', amount: 150 },
        { ingredientId: 'banana', amount: 1 },
      ]),
      NOW,
    );
    expect(qty('tvorog')).toBe(200);
    expect(qty('banana')).toBe(1);
    expect(log.pantryDelta).toEqual([
      { ingredientId: 'tvorog', amount: 150, unit: 'g' },
      { ingredientId: 'banana', amount: 1, unit: 'pcs' },
    ]);
  });

  it('clamps at zero and records only the real amount', () => {
    const log = repos.logs.addManual(entry([{ ingredientId: 'tvorog', amount: 500 }]), NOW);
    expect(qty('tvorog')).toBe(0);
    expect(log.pantryDelta).toEqual([{ ingredientId: 'tvorog', amount: 350, unit: 'g' }]);
  });

  it('works as before without deductions or with products not at home', () => {
    const plain = repos.logs.addManual(entry(), NOW);
    const empty = repos.logs.addManual(entry([]), NOW);
    const absent = repos.logs.addManual(entry([{ ingredientId: 'cheese', amount: 50 }]), NOW);
    expect([plain.pantryDelta, empty.pantryDelta, absent.pantryDelta]).toEqual([null, null, null]);
    expect(qty('tvorog')).toBe(350);
  });

  it('does not duplicate on a repeated save with the same id', () => {
    const first = repos.logs.addManual(entry([{ ingredientId: 'tvorog', amount: 150 }], ID), NOW);
    const second = repos.logs.addManual(entry([{ ingredientId: 'tvorog', amount: 150 }], ID), NOW);
    expect(second).toEqual(first);
    expect(db.select().from(mealLogs).all()).toHaveLength(1);
    expect(qty('tvorog')).toBe(200);
  });

  it('rolls back the deduction when the entry cannot be saved', () => {
    expect(() =>
      repos.logs.addManual(entry([{ ingredientId: 'ghost', amount: 10 }]), NOW),
    ).toThrow();
    expect(db.select().from(mealLogs).all()).toEqual([]);
    expect(qty('tvorog')).toBe(350);
  });
});

describe('Undo and delete', () => {
  it('Undo gives back exactly what was taken', () => {
    repos.pantry.setQuantity('tvorog', 100, NOW);
    const log = repos.logs.addManual(entry([{ ingredientId: 'tvorog', amount: 150 }]), NOW);
    expect(qty('tvorog')).toBe(0);
    repos.pantry.setQuantity('tvorog', 30, NOW); // bought a little meanwhile
    repos.logs.undo(log.id);
    expect(qty('tvorog')).toBe(130);
    repos.logs.undo(log.id); // idempotent
    expect(qty('tvorog')).toBe(130);
  });

  it('Undo re-creates a pantry row removed meanwhile', () => {
    const log = repos.logs.addManual(entry([{ ingredientId: 'tvorog', amount: 150 }]), NOW);
    repos.pantry.remove('tvorog');
    repos.logs.undo(log.id);
    expect(qty('tvorog')).toBe(150);
  });

  it('«только запись» keeps the products deducted; Undo of that brings the entry back', () => {
    const log = repos.logs.addManual(entry([{ ingredientId: 'tvorog', amount: 150 }]), NOW);
    repos.logs.removeEntryOnly(log.id);
    expect(repos.logs.get(log.id)).toBeUndefined();
    expect(qty('tvorog')).toBe(200);
    repos.logs.restore(log);
    expect(repos.logs.get(log.id)).toEqual(log);
    expect(qty('tvorog')).toBe(200);
  });

  it('Undo of «удалить и вернуть» takes the products again', () => {
    const log = repos.logs.addManual(entry([{ ingredientId: 'tvorog', amount: 150 }]), NOW);
    repos.logs.undo(log.id);
    expect(qty('tvorog')).toBe(350);
    repos.logs.restore(log, { productsReturned: true });
    expect(qty('tvorog')).toBe(200);
    expect(repos.logs.get(log.id)?.pantryDelta).toEqual(log.pantryDelta);
  });

  it('re-taking after a delete is clamped and records what was really taken', () => {
    const log = repos.logs.addManual(entry([{ ingredientId: 'tvorog', amount: 150 }]), NOW);
    repos.logs.undo(log.id);
    repos.pantry.setQuantity('tvorog', 40, NOW);
    repos.logs.restore(log, { productsReturned: true });
    expect(qty('tvorog')).toBe(0);
    expect(repos.logs.get(log.id)?.pantryDelta).toEqual([
      { ingredientId: 'tvorog', amount: 40, unit: 'g' },
    ]);

    // Nothing left at all: the entry comes back without a delta.
    repos.logs.undo(log.id);
    repos.pantry.remove('tvorog');
    repos.logs.restore(log, { productsReturned: true });
    expect(repos.logs.get(log.id)?.pantryDelta).toBeNull();
  });
});
