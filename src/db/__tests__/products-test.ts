/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

import { createRepositories, type Repositories } from '../repositories';
import { DuplicateBarcodeError } from '../repositories/lidlRepo';
import { appMeta, lidlProducts, preparedPortions, shoppingItems } from '../schema';
import { SEED_LIDL } from '../seed/lidl';
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
const product = (over: Partial<Parameters<Repositories['lidl']['create']>[0]> = {}) => ({
  ingredientId: 'tvorog',
  title: 'Túró 450 g',
  packageSize: 450,
  packageUnit: 'g' as const,
  priceHuf: 899,
  onSale: false,
  saleUntil: null,
  barcode: null,
  notes: null,
  ...over,
});

describe('seed v3 Lidl catalog', () => {
  it('ships a starter catalog linked to seeded ingredients', () => {
    expect(repos.lidl.list()).toHaveLength(SEED_LIDL.length);
    const ingredientIds = new Set(repos.ingredients.list().map((i) => i.id));
    SEED_LIDL.forEach((p) => expect(ingredientIds).toContain(p.ingredientId));
  });

  it('keeps user edits and deletions of seeded products when re-seeding the same version', () => {
    repos.lidl.update('lidl_tvorog', product({ ingredientId: 'tvorog', title: 'Мой творог' }));
    runSeed(db);
    expect(repos.lidl.list().find((p) => p.id === 'lidl_tvorog')?.title).toBe('Мой творог');
  });

  it('adds the catalog when upgrading from an older seed without overwriting edits', () => {
    repos.lidl.update(
      'lidl_egg',
      product({ ingredientId: 'egg', title: 'Tojás L', packageSize: 6, packageUnit: 'pcs' }),
    );
    db.update(appMeta).set({ value: '2' }).run();
    expect(runSeed(db)).toEqual({ applied: true });
    expect(repos.lidl.list().find((p) => p.id === 'lidl_egg')?.title).toBe('Tojás L');
    expect(repos.lidl.list()).toHaveLength(SEED_LIDL.length);
  });
});

describe('lidlRepo', () => {
  it('creates, updates and removes products', () => {
    const p = repos.lidl.create(product());
    expect(repos.lidl.update(p.id, product({ priceHuf: 799 })).priceHuf).toBe(799);
    repos.lidl.remove(p.id);
    expect(repos.lidl.list().some((x) => x.id === p.id)).toBe(false);
  });

  it('validates input and rejects duplicate barcodes with a clear error', () => {
    expect(() => repos.lidl.create(product({ packageSize: 0 }))).toThrow(ZodError);
    repos.lidl.create(product({ barcode: '5900000000001' }));
    expect(() => repos.lidl.create(product({ barcode: '5900000000001' }))).toThrow(
      DuplicateBarcodeError,
    );
    expect(() => repos.lidl.update('ghost', product())).toThrow('not found');
  });

  it('clears expired sales automatically but keeps current and open-ended ones', () => {
    const expired = repos.lidl.create(product({ onSale: true, saleUntil: '2026-09-26' }));
    const lastDay = repos.lidl.create(product({ onSale: true, saleUntil: '2026-09-27' }));
    const openEnded = repos.lidl.create(product({ onSale: true, saleUntil: null }));

    expect(repos.lidl.clearExpiredSales('2026-09-27')).toBe(1);
    const byId = new Map(repos.lidl.list().map((p) => [p.id, p]));
    expect(byId.get(expired.id)).toMatchObject({ onSale: false, saleUntil: null });
    expect(byId.get(lastDay.id)?.onSale).toBe(true);
    expect(byId.get(openEnded.id)?.onSale).toBe(true);
    expect(repos.lidl.clearExpiredSales('2026-09-27')).toBe(0);
  });
});

describe('shoppingRepo check-off', () => {
  it('«купил» adds whole Lidl packages to the pantry; un-checking takes them back', () => {
    repos.pantry.setQuantity('tvorog', 100);
    repos.shopping.addMissing([{ ingredientId: 'tvorog', amount: 300, unit: 'g' }]);
    const item = repos.shopping.listOpen()[0]!;

    repos.shopping.setChecked(item.id, true, 1);
    expect(qty('tvorog')).toBe(100 + 500); // 2 × 250 g
    repos.shopping.setChecked(item.id, true, 2); // repeated tap
    expect(qty('tvorog')).toBe(600);

    repos.shopping.setChecked(item.id, false, 3);
    expect(qty('tvorog')).toBe(100);
    expect(repos.shopping.listOpen()).toHaveLength(1);
  });

  it('uses the smallest package and converts units (eggs by 10)', () => {
    repos.lidl.create(
      product({ ingredientId: 'egg', title: 'Tojás 6', packageSize: 6, packageUnit: 'pcs' }),
    );
    repos.shopping.addMissing([{ ingredientId: 'egg', amount: 2, unit: 'pcs' }]);
    repos.shopping.setChecked(repos.shopping.listOpen()[0]!.id, true);
    expect(qty('egg')).toBe(6);
  });

  it('adds the wanted amount when there is no Lidl product', () => {
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

describe('lidl product links', () => {
  it('keeps the ingredient link', () => {
    const p = repos.lidl.create(product());
    expect(
      db.select().from(lidlProducts).where(eq(lidlProducts.id, p.id)).get()?.ingredientId,
    ).toBe('tvorog');
  });
});
