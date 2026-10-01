/**
 * @jest-environment node
 *
 * FIXES v1.1 task 5: several products «Домой» in one pass.
 */
import { InvalidBulkAddError } from '../repositories/pantryRepo';
import { createRepositories, type Repositories } from '../repositories';
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
  repos.pantry.setQuantity('tvorog', 200, NOW);
});
afterEach(() => close());

const qty = (id: string) => repos.pantry.get(id)?.quantity;

describe('pantry.addMany', () => {
  it('adds new products and sums with existing ones in one go', () => {
    const result = repos.pantry.addMany(
      [
        { ingredientId: 'tvorog', amount: 250 },
        { ingredientId: 'egg', amount: 10 },
      ],
      NOW,
    );
    expect(qty('tvorog')).toBe(450);
    expect(qty('egg')).toBe(10);
    expect(result.items).toEqual([
      { ingredientId: 'tvorog', amount: 250, created: false },
      { ingredientId: 'egg', amount: 10, created: true },
    ]);
  });

  it('merges duplicates and remembers the amount as the next default', () => {
    repos.pantry.addMany(
      [
        { ingredientId: 'oats', amount: 300 },
        { ingredientId: 'oats', amount: 200 },
      ],
      NOW,
    );
    expect(qty('oats')).toBe(500);
    expect(repos.ingredients.getById('oats')?.lastAddedAmount).toBe(500);
  });

  it('rolls back the whole batch on an unknown product', () => {
    expect(() =>
      repos.pantry.addMany(
        [
          { ingredientId: 'egg', amount: 10 },
          { ingredientId: 'ghost', amount: 1 },
        ],
        NOW,
      ),
    ).toThrow(InvalidBulkAddError);
    expect(qty('egg')).toBeUndefined();
    expect(repos.ingredients.getById('egg')?.lastAddedAmount).toBeNull();
  });

  it('rejects invalid amounts before touching anything', () => {
    for (const amount of [0, -5, Number.NaN, 2_000_000]) {
      expect(() => repos.pantry.addMany([{ ingredientId: 'tvorog', amount }], NOW)).toThrow(
        InvalidBulkAddError,
      );
    }
    expect(qty('tvorog')).toBe(200);
    expect(repos.pantry.addMany([], NOW)).toEqual({ items: [] });
  });

  it('Undo takes back exactly the batch, removing rows it created', () => {
    const result = repos.pantry.addMany(
      [
        { ingredientId: 'tvorog', amount: 250 },
        { ingredientId: 'egg', amount: 10 },
        { ingredientId: 'banana', amount: 3 },
      ],
      NOW,
    );
    repos.pantry.adjust('banana', -1, NOW); // ate one meanwhile
    repos.pantry.undoAddMany(result, NOW);
    expect(qty('tvorog')).toBe(200);
    expect(repos.pantry.get('egg')).toBeUndefined();
    // Created by the batch and nothing left after taking it back: as before the batch.
    expect(repos.pantry.get('banana')).toBeUndefined();

    // A created row that still has stock (bought more meanwhile) stays, reduced.
    const again = repos.pantry.addMany([{ ingredientId: 'apple', amount: 2 }], NOW);
    repos.pantry.adjust('apple', 3, NOW);
    repos.pantry.undoAddMany(again, NOW);
    expect(qty('apple')).toBe(3);
  });
});

describe('shopping.checkMany', () => {
  it('checks several items and adds the chosen amounts home; Undo reverts all', () => {
    const a = repos.shopping.add({
      title: 'Творог',
      ingredientId: 'tvorog',
      quantity: 250,
      unit: 'g',
    });
    const b = repos.shopping.add({ title: 'Яйца', ingredientId: 'egg', quantity: 10, unit: 'pcs' });
    const free = repos.shopping.add({
      title: 'Салфетки',
      ingredientId: null,
      quantity: null,
      unit: null,
    });

    const ids = repos.shopping.checkMany(
      [
        { itemId: a.id, amount: 500 },
        { itemId: b.id, amount: 10 },
        { itemId: free.id, amount: 1 },
      ],
      NOW,
    );
    expect(ids).toEqual([a.id, b.id]);
    expect(qty('tvorog')).toBe(700);
    expect(qty('egg')).toBe(10);
    expect(
      repos.shopping
        .list()
        .filter((i) => i.checked)
        .map((i) => i.id)
        .sort(),
    ).toEqual([a.id, b.id].sort());

    // Already checked: a repeat does nothing.
    expect(repos.shopping.checkMany([{ itemId: a.id, amount: 500 }], NOW)).toEqual([]);

    repos.shopping.uncheckMany(ids, NOW);
    expect(qty('tvorog')).toBe(200);
    expect(qty('egg')).toBe(0);
    expect(repos.shopping.listOpen()).toHaveLength(3);
  });

  it('rejects invalid amounts', () => {
    const a = repos.shopping.add({
      title: 'Творог',
      ingredientId: 'tvorog',
      quantity: 250,
      unit: 'g',
    });
    expect(() => repos.shopping.checkMany([{ itemId: a.id, amount: 0 }], NOW)).toThrow(RangeError);
    expect(qty('tvorog')).toBe(200);
  });
});
