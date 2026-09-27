/**
 * @jest-environment node
 */
import { shoppingItems } from '../schema';
import { createRepositories, type Repositories } from '../repositories';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
});
afterEach(() => close());

const open = () =>
  repos.shopping
    .listOpen()
    .map((i) => [i.ingredientId, i.title, i.quantity, i.unit])
    .sort();

describe('shoppingRepo.addMissing', () => {
  it('rounds shortages up to whole Lidl packages (the amount to actually buy)', () => {
    const n = repos.shopping.addMissing([
      { ingredientId: 'tvorog', amount: 49.2, unit: 'g' }, // pack 250 g
      { ingredientId: 'egg', amount: 1.5, unit: 'pcs' }, // pack of 10
    ]);
    expect(n).toBe(2);
    expect(open()).toEqual([
      ['egg', 'Яйцо', 10, 'pcs'],
      ['tvorog', 'Творог', 250, 'g'],
    ]);
  });

  it('rounds up to whole units without a Lidl package', () => {
    repos.shopping.addMissing([
      { ingredientId: 'apple', amount: 1.5, unit: 'pcs' },
      { ingredientId: 'cucumber', amount: 99.2, unit: 'g' },
    ]);
    expect(open()).toEqual([
      ['apple', 'Яблоко', 2, 'pcs'],
      ['cucumber', 'Огурец', 100, 'g'],
    ]);
  });

  it('stores the amount in the ingredient unit even if the shortage uses another', () => {
    // 150 g of onion = 1.5 шт → 1 kg Lidl pack (10 шт at 100 g each).
    repos.shopping.addMissing([{ ingredientId: 'onion', amount: 150, unit: 'g' }]);
    expect(open()).toEqual([['onion', 'Лук', 10, 'pcs']]);
  });

  it('is idempotent and keeps the larger amount', () => {
    const shortage = { ingredientId: 'tvorog', amount: 100, unit: 'g' as const };
    repos.shopping.addMissing([shortage]);
    expect(repos.shopping.addMissing([shortage])).toBe(0);
    expect(repos.shopping.addMissing([{ ...shortage, amount: 60 }])).toBe(0);
    expect(repos.shopping.addMissing([{ ...shortage, amount: 300 }])).toBe(1);
    expect(open()).toEqual([['tvorog', 'Творог', 500, 'g']]);
  });

  it('lets the amount of an open item be changed, but not below zero or when bought', () => {
    repos.shopping.addMissing([{ ingredientId: 'tvorog', amount: 100, unit: 'g' }]);
    const id = repos.shopping.listOpen()[0]!.id;
    repos.shopping.setQuantity(id, 750);
    expect(open()).toEqual([['tvorog', 'Творог', 750, 'g']]);
    expect(() => repos.shopping.setQuantity(id, 0)).toThrow(RangeError);
    repos.shopping.setChecked(id, true);
    repos.shopping.setQuantity(id, 100);
    expect(repos.shopping.list()[0]?.quantity).toBe(750);
  });

  it('«купил» adds exactly the listed amount to the pantry', () => {
    repos.shopping.addMissing([{ ingredientId: 'tvorog', amount: 100, unit: 'g' }]);
    const id = repos.shopping.listOpen()[0]!.id;
    repos.shopping.setQuantity(id, 300);
    repos.shopping.setChecked(id, true);
    expect(repos.pantry.get('tvorog')?.quantity).toBe(300);
  });

  it('starts a new open item once the old one is checked off', () => {
    repos.shopping.addMissing([{ ingredientId: 'egg', amount: 2, unit: 'pcs' }]);
    db.update(shoppingItems).set({ checked: true }).run();
    repos.shopping.addMissing([{ ingredientId: 'egg', amount: 2, unit: 'pcs' }]);
    expect(db.select().from(shoppingItems).all()).toHaveLength(2);
  });

  it('enforces one open item per ingredient at the DB level', () => {
    const row = { title: 'x', ingredientId: 'egg', createdAt: 0 };
    db.insert(shoppingItems)
      .values({ ...row, id: 'a' })
      .run();
    expect(() =>
      db
        .insert(shoppingItems)
        .values({ ...row, id: 'b' })
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it('rejects unknown ingredients without partial writes', () => {
    expect(() =>
      repos.shopping.addMissing([
        { ingredientId: 'tvorog', amount: 1, unit: 'g' },
        { ingredientId: 'ghost', amount: 1, unit: 'g' },
      ]),
    ).toThrow('Ingredient not found');
    expect(repos.shopping.listOpen()).toEqual([]);
  });

  it('does nothing for an empty list', () => {
    expect(repos.shopping.addMissing([])).toBe(0);
  });
});
