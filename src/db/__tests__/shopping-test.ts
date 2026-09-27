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
  it('adds shortages with ingredient names, rounding amounts up', () => {
    const n = repos.shopping.addMissing([
      { ingredientId: 'tvorog', amount: 49.2, unit: 'g' },
      { ingredientId: 'egg', amount: 1.5, unit: 'pcs' },
    ]);
    expect(n).toBe(2);
    expect(open()).toEqual([
      ['egg', 'Яйцо', 2, 'pcs'],
      ['tvorog', 'Творог', 50, 'g'],
    ]);
  });

  it('is idempotent and keeps the larger amount', () => {
    const shortage = { ingredientId: 'tvorog', amount: 100, unit: 'g' as const };
    repos.shopping.addMissing([shortage]);
    expect(repos.shopping.addMissing([shortage])).toBe(0);
    expect(repos.shopping.addMissing([{ ...shortage, amount: 60 }])).toBe(0);
    expect(repos.shopping.addMissing([{ ...shortage, amount: 300 }])).toBe(1);
    expect(open()).toEqual([['tvorog', 'Творог', 300, 'g']]);
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
