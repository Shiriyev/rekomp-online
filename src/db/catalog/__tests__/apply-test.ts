/**
 * @jest-environment node
 *
 * PHASE_2 task 7: the catalog update keeps every piece of user data.
 */
import { eq } from 'drizzle-orm';

import catalogJson from '../../seed/catalog.v2.json';
import { createRepositories } from '../../repositories';
import {
  appMeta,
  hiddenRecipes,
  ingredients,
  mealLogs,
  pantryItems,
  recipeCustomAmounts,
  recipes,
  recipeSteps,
} from '../../schema';
import { runSeed } from '../../seed/runSeed';
import { createTestDb } from '../../testing/createTestDb';
import type { AppDb } from '../../types';
import {
  applyCatalog,
  normalizeName,
  storedCatalogVersion,
  UNSUPPORTED_PRODUCTS_KEY,
} from '../apply';
import type { Catalog } from '../schema';

const catalog = catalogJson as Catalog;
const apply = (db: AppDb) => applyCatalog(db, catalog.catalogVersion, () => catalog);

let db: AppDb;
let close: () => void;
beforeEach(() => ({ db, close } = createTestDb()));
afterEach(() => close());

describe('fresh install', () => {
  it('loads the whole catalog once', () => {
    const result = apply(db);
    expect(result.applied).toBe(true);
    expect(db.select().from(recipes).all()).toHaveLength(catalog.recipes.length);
    expect(db.select().from(ingredients).all()).toHaveLength(catalog.ingredients.length);
    expect(storedCatalogVersion(db)).toBe(catalog.catalogVersion);

    const load = jest.fn(() => catalog);
    expect(applyCatalog(db, catalog.catalogVersion, load)).toEqual({ applied: false });
    expect(load).not.toHaveBeenCalled(); // the large file is not even read
  });

  it('carries English texts and meal types', () => {
    apply(db);
    const r = db.select().from(recipes).where(eq(recipes.id, 'own_b_syrniki')).get();
    expect(r?.nameEn).toBe('Cottage cheese pancakes with berries');
    expect(r?.mealTypes).toEqual(['breakfast']);
    const step = db.select().from(recipeSteps).where(eq(recipeSteps.recipeId, 'Z1')).get();
    expect(step?.textEn).toMatch(/^In the evening/);
  });
});

describe('upgrade of a v1 install', () => {
  function v1WithUserData() {
    runSeed(db);
    const repos = createRepositories(db);
    repos.pantry.setQuantity('tvorog', 400, 1);
    repos.ingredients.updateSettings('egg', {
      kcalPer100g: 150,
      proteinPer100g: 13,
      gramsPerPiece: 60,
      lowStockThreshold: 4,
    });
    repos.recipes.saveCustomAmounts('Z1', { tvorog: 200 });
    repos.recipes.setPhoto('Z1', 'file:///photos/z1.jpg');
    // An old row still in a v1 category (as after importing a v1 backup).
    db.update(ingredients)
      .set({ category: 'dairy' as never })
      .where(eq(ingredients.id, 'skyr'))
      .run();
    return repos;
  }

  it('keeps pantry, own amounts, photos and edited nutrition', () => {
    const repos = v1WithUserData();
    apply(db);

    expect(repos.pantry.get('tvorog')?.quantity).toBe(400);
    expect(db.select().from(recipes).where(eq(recipes.id, 'Z1')).get()?.photoUri).toBe(
      'file:///photos/z1.jpg',
    );

    const egg = repos.ingredients.getById('egg');
    expect([egg?.kcalPer100g, egg?.gramsPerPiece, egg?.lowStockThreshold]).toEqual([150, 60, 4]);
    expect(egg?.nameEn).toBe('Egg'); // catalog columns still updated

    expect(repos.ingredients.getById('skyr')?.category).toBe('dairy_eggs');
    expect(db.select().from(recipes).all()).toHaveLength(catalog.recipes.length);
  });

  it('archives what left the catalog but is still used, deletes the rest', () => {
    runSeed(db);
    const extra = {
      category: 'other' as const,
      unit: 'g' as const,
      kcalPer100g: 1,
      proteinPer100g: 0,
    };
    db.insert(ingredients)
      .values([
        { id: 'old_used', name: 'Старый', ...extra },
        { id: 'old_unused', name: 'Никому не нужный', ...extra },
      ])
      .run();
    db.insert(pantryItems)
      .values({ ingredientId: 'old_used', quantity: 5, unit: 'g', updatedAt: 1 })
      .run();
    db.insert(recipes)
      .values({ id: 'OLD', name: 'Старое блюдо', mealType: 'lunch', totalMinutes: 5 })
      .run();
    db.insert(mealLogs)
      .values({
        id: 'log1',
        timestamp: 1,
        localDate: '2026-01-01',
        mealType: 'lunch',
        name: 'Старое блюдо',
        kcal: 500,
        protein: 30,
        source: 'recipe',
        recipeId: 'OLD',
      } as never)
      .run();

    const result = apply(db);
    expect(result.applied && result.archived).toEqual({ ingredients: 1, recipes: 1 });
    expect(
      db.select().from(ingredients).where(eq(ingredients.id, 'old_unused')).get(),
    ).toBeUndefined();
    expect(
      db.select().from(ingredients).where(eq(ingredients.id, 'old_used')).get()?.isArchived,
    ).toBe(true);
    expect(db.select().from(recipes).where(eq(recipes.id, 'OLD')).get()?.isArchived).toBe(true);
    expect(db.select().from(mealLogs).where(eq(mealLogs.id, 'log1')).get()?.recipeId).toBe('OLD');
  });

  it('archives a pruned dish the user saved, edited or hid; hidden dishes stay hidden', () => {
    runSeed(db);
    const repos = createRepositories(db);
    const dish = (id: string) => ({ id, name: id, mealType: 'lunch' as const, totalMinutes: 5 });
    db.insert(recipes).values(['GONE_FAV', 'GONE_MINE', 'GONE_HID', 'GONE_NONE'].map(dish)).run();
    repos.recipes.toggleFavorite('GONE_FAV');
    db.insert(recipeCustomAmounts)
      .values({ recipeId: 'GONE_MINE', ingredientId: 'tvorog', amountPerServing: 100 })
      .run();
    repos.recipes.hide('GONE_HID');
    repos.recipes.hide('P4');

    const result = apply(db);
    expect(result.applied && result.archived.recipes).toBe(3);
    const archived = (id: string) =>
      db.select().from(recipes).where(eq(recipes.id, id)).get()?.isArchived;
    expect(['GONE_FAV', 'GONE_MINE', 'GONE_HID'].map(archived)).toEqual([true, true, true]);
    expect(archived('GONE_NONE')).toBeUndefined();
    expect(
      db
        .select()
        .from(hiddenRecipes)
        .all()
        .map((h) => h.recipeId)
        .sort(),
    ).toEqual(['GONE_HID', 'P4']);
  });

  it('merges custom products into catalog products of the same name, lists the rest', () => {
    runSeed(db);
    const repos = createRepositories(db);
    const broccoli = repos.ingredients.createCustom({
      name: 'брокколи',
      category: 'vegetables',
      unit: 'g',
      gramsPerPiece: null,
      kcalPer100g: 34,
      proteinPer100g: 3,
    });
    repos.pantry.setQuantity(broccoli.id, 300, 1);
    const bar = repos.ingredients.createCustom({
      name: 'Протеиновый батончик Х',
      category: 'other',
      unit: 'pcs',
      gramsPerPiece: 60,
      kcalPer100g: 380,
      proteinPer100g: 33,
    });

    const result = apply(db);
    expect(result.applied && result.merged).toBe(1);
    expect(result.applied && result.unsupported).toEqual(['Протеиновый батончик Х']);
    expect(repos.ingredients.getById(broccoli.id)).toBeUndefined();
    expect(repos.pantry.get('broccoli')?.quantity).toBe(300);
    expect(repos.ingredients.getById(bar.id)?.isArchived).toBe(true);
    const listed = db.select().from(appMeta).where(eq(appMeta.key, UNSUPPORTED_PRODUCTS_KEY)).get();
    expect(JSON.parse(listed!.value)).toEqual(['Протеиновый батончик Х']);
  });
});

it('changes nothing when the catalog cannot be used', () => {
  runSeed(db);
  const before = db.select().from(recipes).all();
  const wrong = catalog.catalogVersion + 1;
  expect(() => applyCatalog(db, wrong, () => catalog)).toThrow(`expected ${wrong}`);
  expect(db.select().from(recipes).all()).toEqual(before);
  expect(storedCatalogVersion(db)).toBe(0);
});

it('normalizes names for matching', () => {
  expect(normalizeName('  Ёжик-Túró! ')).toBe('ежик turo');
});
