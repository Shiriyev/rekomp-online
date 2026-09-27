/**
 * @jest-environment node
 */
import { ZodError } from 'zod';

import { createRepositories, type Repositories } from '../repositories';
import type { ProfileInput } from '../../domain/schemas';
import { appMeta, pantryItems, weightLogs } from '../schema';
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

describe('recipesRepo', () => {
  it('lists recipes of a meal type in seed order', () => {
    expect(repos.recipes.listByMealType('breakfast').map((r) => r.id)).toEqual([
      'Z1',
      'Z2',
      'Z3',
      'Z4',
    ]);
  });

  it('returns a recipe with ordered lines and steps', () => {
    const detail = repos.recipes.getDetail('Z2');
    expect(detail?.recipe.name).toBe('Овсянка со скиром и яйцами');
    expect(detail?.lines.map((l) => l.ingredientId)).toEqual([
      'oats',
      'skyr',
      'greek_yogurt',
      'berries_frozen',
      'egg',
    ]);
    expect(detail?.lines.find((l) => l.ingredientId === 'greek_yogurt')?.altGroup).toBe('yogurt');
    expect(detail?.steps.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(detail?.steps[0]?.ingredientRefs).toEqual(['egg']);
  });

  it('returns undefined for an unknown recipe', () => {
    expect(repos.recipes.getDetail('nope')).toBeUndefined();
  });

  it('filters details by meal type', () => {
    expect(repos.recipes.listDetails('lunch')).toHaveLength(4);
    expect(repos.recipes.listDetails()).toHaveLength(16);
  });
});

describe('ingredientsRepo', () => {
  it('updates nutrition with validation', () => {
    repos.ingredients.updateNutrition('tvorog', {
      kcalPer100g: 98,
      proteinPer100g: 18,
      gramsPerPiece: null,
    });
    expect(repos.ingredients.getById('tvorog')?.kcalPer100g).toBe(98);

    expect(() =>
      repos.ingredients.updateNutrition('tvorog', {
        kcalPer100g: -5,
        proteinPer100g: 18,
        gramsPerPiece: null,
      }),
    ).toThrow(ZodError);
    expect(() =>
      repos.ingredients.updateNutrition('ghost', {
        kcalPer100g: 1,
        proteinPer100g: 1,
        gramsPerPiece: null,
      }),
    ).toThrow('Ingredient not found');
  });
});

describe('pantryRepo', () => {
  it('stores quantities in the ingredient unit, normalised', () => {
    expect(repos.pantry.setQuantity('tvorog', 349.7, 1000)).toEqual({
      ingredientId: 'tvorog',
      quantity: 350,
      unit: 'g',
      updatedAt: 1000,
    });
    expect(repos.pantry.setQuantity('egg', 7, 2000).unit).toBe('pcs');
  });

  it('adjusts relative to the current value and clamps at zero', () => {
    repos.pantry.setQuantity('egg', 3);
    expect(repos.pantry.adjust('egg', 2).quantity).toBe(5);
    expect(repos.pantry.adjust('egg', -10).quantity).toBe(0);
    expect(repos.pantry.adjust('oats', 50).quantity).toBe(50); // creates when missing
  });

  it('rejects negative, non-finite and unknown ingredients', () => {
    expect(() => repos.pantry.setQuantity('egg', -1)).toThrow(ZodError);
    expect(() => repos.pantry.adjust('egg', Number.NaN)).toThrow(RangeError);
    expect(() => repos.pantry.setQuantity('ghost', 1)).toThrow('Ingredient not found');
  });

  it('removes items', () => {
    repos.pantry.setQuantity('egg', 3);
    repos.pantry.remove('egg');
    expect(repos.pantry.get('egg')).toBeUndefined();
    expect(repos.pantry.list()).toEqual([]);
  });

  it('enforces foreign keys and the non-negative check at the DB level', () => {
    expect(() =>
      db
        .insert(pantryItems)
        .values({ ingredientId: 'ghost', quantity: 1, unit: 'g', updatedAt: 0 })
        .run(),
    ).toThrow(/FOREIGN KEY/);
    expect(() =>
      db
        .insert(pantryItems)
        .values({ ingredientId: 'egg', quantity: -1, unit: 'pcs', updatedAt: 0 })
        .run(),
    ).toThrow(/CHECK/);
  });
});

describe('logRepo', () => {
  // 21:30 UTC = 23:30 Budapest (27 Sep), 22:30 UTC = 00:30 Budapest (28 Sep).
  const lateEvening = Date.UTC(2026, 8, 27, 21, 30);
  const afterMidnight = Date.UTC(2026, 8, 27, 22, 30);

  it('adds a validated manual entry grouped by local date', () => {
    const log = repos.logs.addManual(
      { name: '  Сникерс ', kcal: 250, protein: 4.3, mealType: 'snack' },
      lateEvening,
    );
    expect(log).toMatchObject({
      name: 'Сникерс',
      source: 'manual',
      localDate: '2026-09-27',
      kcal: 250,
      protein: 4.3,
      recipeId: null,
      cookSessionId: null,
    });
    expect(log.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('computes day totals per local date', () => {
    repos.logs.addManual({ name: 'A', kcal: 500, protein: 40, mealType: 'breakfast' }, lateEvening);
    repos.logs.addManual({ name: 'B', kcal: 200, protein: 10.5, mealType: 'snack' }, lateEvening);
    repos.logs.addManual(
      { name: 'C', kcal: 300, protein: 20, mealType: 'breakfast' },
      afterMidnight,
    );

    expect(repos.logs.dayTotals('2026-09-27')).toEqual({ kcal: 700, protein: 50.5 });
    expect(repos.logs.dayTotals('2026-09-28')).toEqual({ kcal: 300, protein: 20 });
    expect(repos.logs.dayTotals('2026-09-29')).toEqual({ kcal: 0, protein: 0 });
    expect(repos.logs.listByDate('2026-09-27').map((l) => l.name)).toEqual(['A', 'B']);
  });

  it.each([
    { name: '', kcal: 100, protein: 1, mealType: 'snack' },
    { name: 'x', kcal: 10.5, protein: 1, mealType: 'snack' },
    { name: 'x', kcal: -1, protein: 1, mealType: 'snack' },
    { name: 'x', kcal: 1, protein: 1, mealType: 'brunch' },
  ])('rejects invalid input %j', (input) => {
    // @ts-expect-error: deliberately invalid mealType in one case
    expect(() => repos.logs.addManual(input)).toThrow(ZodError);
  });

  it('removes entries', () => {
    const log = repos.logs.addManual({ name: 'A', kcal: 1, protein: 1, mealType: 'snack' });
    repos.logs.remove(log.id);
    expect(repos.logs.listByDate(log.localDate)).toEqual([]);
  });
});

describe('profileRepo', () => {
  const base: ProfileInput = {
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 85,
    activityLevel: 'moderate',
    goalRateKgPerWeek: -0.5,
    kcalTarget: 2150,
    proteinTargetG: 140,
    proteinMinG: 120,
    targetOverridden: true,
  };
  const day1 = Date.UTC(2026, 8, 27, 10);
  const day2 = Date.UTC(2026, 8, 28, 10);

  it('upserts the single profile row', () => {
    expect(repos.profile.get()).toBeUndefined();
    repos.profile.save(base, day1);
    repos.profile.save({ ...base, weightKg: 84 }, day2);
    expect(repos.profile.get()).toMatchObject({ id: 1, weightKg: 84, updatedAt: day2 });
  });

  it('records one weight entry per local day, last value wins', () => {
    repos.profile.save(base, day1);
    repos.profile.save({ ...base, weightKg: 84.6 }, day1 + 1000);
    repos.profile.save({ ...base, weightKg: 84.2 }, day2);
    expect(db.select().from(weightLogs).orderBy(weightLogs.localDate).all()).toEqual([
      { localDate: '2026-09-27', weightKg: 84.6 },
      { localDate: '2026-09-28', weightKg: 84.2 },
    ]);
  });

  it('validates before writing anything', () => {
    expect(() => repos.profile.save({ ...base, proteinMinG: 150 })).toThrow(ZodError);
    expect(() => repos.profile.save({ ...base, age: 12 })).toThrow(ZodError);
    expect(repos.profile.get()).toBeUndefined();
    expect(db.select().from(weightLogs).all()).toEqual([]);
  });
});

describe('settingsRepo', () => {
  it('defaults to the system theme and persists a choice', () => {
    expect(repos.settings.getTheme()).toBe('system');
    repos.settings.setTheme('dark');
    expect(repos.settings.getTheme()).toBe('dark');
  });

  it('stores the cooking view and rejects unknown ones', () => {
    repos.settings.setCookView('overview');
    expect(db.select().from(appMeta).all()).toContainEqual({ key: 'cook_view', value: 'overview' });
    // @ts-expect-error: invalid on purpose
    expect(() => repos.settings.setCookView('grid')).toThrow(RangeError);
  });

  it('rejects unknown themes', () => {
    // @ts-expect-error: invalid on purpose
    expect(() => repos.settings.setTheme('neon')).toThrow(ZodError);
  });
});
