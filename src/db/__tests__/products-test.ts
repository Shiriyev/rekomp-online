/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { createRepositories, type Repositories } from '../repositories';
import { preparedPortions, shoppingItems } from '../schema';
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

const qty = (id: string) => repos.pantry.get(id)?.quantity;
describe('shoppingRepo check-off', () => {
  it('«купил» adds the wanted amount to the pantry; un-checking takes it back', () => {
    repos.pantry.setQuantity('tvorog', 100);
    repos.shopping.addMissing([{ ingredientId: 'tvorog', amount: 300, unit: 'g' }]);
    const item = repos.shopping.listOpen()[0]!;

    repos.shopping.setChecked(item.id, true, 1);
    expect(qty('tvorog')).toBe(400);
    repos.shopping.setChecked(item.id, true, 2); // repeated tap
    expect(qty('tvorog')).toBe(400);

    repos.shopping.setChecked(item.id, false, 3);
    expect(qty('tvorog')).toBe(100);
    expect(repos.shopping.listOpen()).toHaveLength(1);
  });

  it('a piece product without an amount adds one piece', () => {
    const item = repos.shopping.add({
      title: 'Яйцо',
      ingredientId: 'egg',
      quantity: null,
      unit: null,
    });
    repos.shopping.setChecked(item.id, true);
    expect(qty('egg')).toBe(1);
  });

  it('adds the wanted amount in the product unit', () => {
    repos.shopping.addMissing([{ ingredientId: 'apple', amount: 3, unit: 'pcs' }]);
    repos.shopping.setChecked(repos.shopping.listOpen()[0]!.id, true);
    expect(qty('apple')).toBe(3);
  });

  it('never drives the pantry negative when un-checking after use', () => {
    repos.shopping.addMissing([{ ingredientId: 'apple', amount: 3, unit: 'pcs' }]);
    const id = repos.shopping.listOpen()[0]!.id;
    repos.shopping.setChecked(id, true);
    repos.pantry.setQuantity('apple', 1);
    repos.shopping.setChecked(id, false);
    expect(qty('apple')).toBe(0);
  });

  it('merges back into an open item of the same ingredient when un-checking', () => {
    repos.shopping.addMissing([{ ingredientId: 'apple', amount: 2, unit: 'pcs' }]);
    const first = repos.shopping.listOpen()[0]!.id;
    repos.shopping.setChecked(first, true);
    repos.shopping.addMissing([{ ingredientId: 'apple', amount: 1, unit: 'pcs' }]);
    repos.shopping.setChecked(first, false);
    expect(repos.shopping.list()).toHaveLength(1);
    expect(qty('apple')).toBe(0);
  });

  it('manual items: free text, or merged into the ingredient open item', () => {
    repos.shopping.add({
      title: 'Бумажные полотенца',
      ingredientId: null,
      quantity: null,
      unit: null,
    });
    repos.shopping.add({ title: 'Творог', ingredientId: 'tvorog', quantity: 200, unit: 'g' });
    repos.shopping.add({ title: 'Творог', ingredientId: 'tvorog', quantity: 100, unit: 'g' });
    const items = repos.shopping.list();
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.ingredientId === 'tvorog')?.quantity).toBe(300);
    expect(() =>
      repos.shopping.add({ title: '', ingredientId: null, quantity: null, unit: null }),
    ).toThrow(ZodError);
  });

  it('checking a free-text item does not touch the pantry; clearing removes bought items only', () => {
    const towels = repos.shopping.add({
      title: 'Полотенца',
      ingredientId: null,
      quantity: null,
      unit: null,
    });
    repos.shopping.add({ title: 'Скир', ingredientId: 'skyr', quantity: 150, unit: 'g' });
    repos.shopping.setChecked(towels.id, true);
    expect(repos.pantry.list()).toEqual([]);
    expect(repos.shopping.clearChecked()).toBe(1);
    expect(repos.shopping.list().map((i) => i.title)).toEqual(['Скир']);
  });

  it('removes items and ignores unknown ids', () => {
    const item = repos.shopping.add({ title: 'X', ingredientId: null, quantity: null, unit: null });
    repos.shopping.remove(item.id);
    repos.shopping.setChecked('ghost', true);
    expect(db.select().from(shoppingItems).all()).toEqual([]);
  });
});

describe('ingredientsRepo custom products and settings', () => {
  it('creates a custom ingredient usable in the pantry', () => {
    const bar = repos.ingredients.createCustom({
      name: 'Протеиновый батончик',
      category: 'dairy_eggs',
      unit: 'pcs',
      gramsPerPiece: 60,
      kcalPer100g: 350,
      proteinPer100g: 33,
    });
    expect(bar).toMatchObject({ isCustom: true, isStaple: false, unit: 'pcs' });
    expect(bar.id).toMatch(/^custom_/);
    repos.pantry.setQuantity(bar.id, 4);
    expect(qty(bar.id)).toBe(4);
  });

  it('drops grams per piece for weight-based custom ingredients', () => {
    const c = repos.ingredients.createCustom({
      name: 'Кефир',
      category: 'dairy_eggs',
      unit: 'ml',
      gramsPerPiece: 250,
      kcalPer100g: 40,
      proteinPer100g: 3,
    });
    expect(c.gramsPerPiece).toBeNull();
  });

  it('updates nutrition and the low-stock threshold', () => {
    repos.ingredients.updateSettings('tvorog', {
      kcalPer100g: 98,
      proteinPer100g: 18,
      gramsPerPiece: null,
      lowStockThreshold: 250,
    });
    expect(repos.ingredients.getById('tvorog')).toMatchObject({
      kcalPer100g: 98,
      lowStockThreshold: 250,
    });
    expect(() =>
      repos.ingredients.updateSettings('ghost', {
        kcalPer100g: 1,
        proteinPer100g: 1,
        gramsPerPiece: null,
        lowStockThreshold: null,
      }),
    ).toThrow('not found');
  });
});

describe('portionsRepo.setPortionsLeft', () => {
  it('corrects the count and validates it', () => {
    db.insert(preparedPortions)
      .values({
        id: 'p',
        recipeId: 'O1',
        portionsLeft: 3,
        kcalPerPortion: 700,
        proteinPerPortion: 60,
        cookedAt: 0,
      })
      .run();
    repos.portions.setPortionsLeft('p', 1);
    expect(
      db.select().from(preparedPortions).where(eq(preparedPortions.id, 'p')).get()?.portionsLeft,
    ).toBe(1);
    repos.portions.setPortionsLeft('p', 0);
    expect(repos.portions.listAvailable()).toEqual([]);
    expect(() => repos.portions.setPortionsLeft('p', -1)).toThrow(RangeError);
    expect(() => repos.portions.setPortionsLeft('p', 1.5)).toThrow(RangeError);
  });
});
