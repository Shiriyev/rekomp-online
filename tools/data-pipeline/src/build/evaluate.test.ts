import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MealDbRecipe } from '../mealdb/load.ts';
import type { UsdaFood } from '../usda/load.ts';
import { estimateMinutes, evaluate, type Context } from './evaluate.ts';
import type { Canonical } from './mappings.ts';

const product = (over: Partial<Canonical> & Pick<Canonical, 'id'>): Canonical => ({
  nameEn: over.id,
  category: 'other',
  subcategory: 'other',
  unit: 'g',
  gramsPerPiece: null,
  usdaFdcId: null,
  manualMacros: { kcal: 0, protein: 0, fat: null, carbs: null },
  isStaple: false,
  stockTracked: true,
  tags: ['vegetarian', 'vegan'],
  synonyms: [],
  ...over,
});

const usdaOil: UsdaFood = {
  fdcId: 1,
  dataset: 'srLegacy',
  description: 'Oil, olive',
  category: 'Fats',
  kcal: 884,
  protein: 0,
  fat: 100,
  carbs: 0,
  portions: [{ amount: 1, unit: 'undetermined', modifier: 'tbsp', grams: 13.5 }],
};

const ctx: Context = {
  products: new Map(
    [
      product({
        id: 'chicken_breast',
        tags: [],
        manualMacros: { kcal: 165, protein: 31, fat: 3.6, carbs: 0 },
      }),
      product({ id: 'rice', manualMacros: { kcal: 365, protein: 7, fat: 0.6, carbs: 80 } }),
      product({ id: 'olive_oil', usdaFdcId: 1, manualMacros: null }),
      product({ id: 'salt', isStaple: true }),
      product({
        id: 'pasta',
        tags: ['vegetarian', 'vegan', 'gluten'],
        manualMacros: { kcal: 371, protein: 13, fat: 1.5, carbs: 75 },
      }),
      product({
        id: 'red_wine',
        tags: ['vegetarian', 'vegan', 'alcohol'],
        manualMacros: { kcal: 85, protein: 0, fat: 0, carbs: 3 },
      }),
      product({
        id: 'bacon',
        tags: ['pork'],
        manualMacros: { kcal: 417, protein: 37, fat: 29, carbs: 1 },
      }),
    ].map((p) => [p.id, p]),
  ),
  map: {
    'chicken breast': 'chicken_breast',
    rice: 'rice',
    'olive oil': 'olive_oil',
    salt: 'salt',
    pasta: 'pasta',
    'red wine': 'red_wine',
    bacon: 'bacon',
  },
  usda: new Map([[1, usdaOil]]),
  unitGrams: { default: { tbsp: 15 }, perProduct: {} },
};

const recipe = (lines: [string, string][], over: Partial<MealDbRecipe> = {}): MealDbRecipe => ({
  id: '1',
  name: 'Test',
  category: 'Chicken',
  area: 'British',
  instructions: 'Cook.',
  thumb: null,
  tags: [],
  source: null,
  lines: lines.map(([measure, ingredient]) => ({ measure, ingredient })),
  ...over,
});

test('accepts a high-protein main and sizes the portion for its meal', () => {
  const r = evaluate(
    recipe([
      ['500g', 'Chicken Breasts'],
      ['200g', 'Rice'],
      ['2 tbsp', 'Olive Oil'],
      ['Pinch', 'Salt'],
    ]),
    ctx,
  );
  assert.equal(r.status, 'accepted');
  if (r.status !== 'accepted') return;
  // 825 + 730 + 2 × 13.5 g oil (USDA tbsp) ≈ 1794 kcal → 3 servings of ~598 kcal. The
  // widened bands overlap, so that portion is a plausible lunch and a plausible dinner;
  // the primary meal is whichever band's middle it sits closest to.
  assert.equal(r.servings, 3);
  assert.equal(r.mealType, 'dinner');
  assert.deepEqual(r.mealTypes, ['lunch', 'dinner']);
  assert.ok(Math.abs(r.perServing.kcal - 598) < 2);
  assert.ok(r.perServing.protein > 50);
  assert.equal(r.lines.find((l) => l.ingredientId === 'olive_oil')?.gramsSource, 'usda');
  assert.equal(r.lines.find((l) => l.ingredientId === 'salt')?.staple, true);
  assert.deepEqual(r.tags, []);
});

test('rejects with one clear reason', () => {
  const reason = (rec: MealDbRecipe) => {
    const r = evaluate(rec, ctx);
    return r.status === 'rejected' ? r.reason : 'accepted';
  };
  // Desserts are no longer excluded by category: allowedMeals sends them to snack, and
  // they stand or fall on protein like anything else.
  assert.notEqual(reason(recipe([['1', 'Rice']], { category: 'Dessert' })), 'dessert');
  assert.equal(reason(recipe([['100g', 'Unicorn Meat']])), 'unmapped_ingredient');
  assert.equal(
    reason(
      recipe([
        ['300g', 'Pasta'],
        ['3 tbsp', 'Olive Oil'],
      ]),
    ),
    'low_protein',
  );
  assert.equal(
    reason(
      recipe([
        ['500g', 'Chicken Breasts'],
        ['200g', 'Rice'],
        ['300ml', 'Red Wine'],
      ]),
    ),
    'alcohol_based',
  );
  assert.equal(
    reason(
      recipe(
        [
          ['500g', 'Chicken Breasts'],
          ['200g', 'Rice'],
        ],
        { instructions: 'Simmer for 4 hours.' },
      ),
    ),
    'too_long',
  );
  assert.equal(reason(recipe([['50g', 'Rice']])), 'no_serving_fits');
});

test('tags recipes instead of dropping pork and gluten', () => {
  const r = evaluate(
    recipe([
      ['400g', 'Bacon'],
      ['250g', 'Pasta'],
    ]),
    ctx,
  );
  assert.equal(r.status, 'accepted');
  if (r.status === 'accepted') assert.deepEqual(r.tags.sort(), ['gluten', 'pork']);
});

test('estimateMinutes adds stated durations', () => {
  assert.equal(estimateMinutes('Fry for 5 minutes, then simmer 20-25 mins.'), 30);
  assert.equal(estimateMinutes('Bake 1 hour.'), 60);
  assert.equal(estimateMinutes('Mix well.'), null);
  assert.equal(estimateMinutes('Marinate for 24 hours. Grill for 10 minutes.'), 10);
  assert.equal(estimateMinutes('Simmer 2 hours.\nLeave to rest 15 minutes.'), 120);
});

test('reviewed meal extras add a meal only with the same servings, or carry a small dish', () => {
  const main = recipe([
    ['500g', 'Chicken Breasts'],
    ['200g', 'Rice'],
    ['2 tbsp', 'Olive Oil'],
  ]);
  const withSnack: Context = { ...ctx, mealExtras: { mdb_1: ['snack'] } };
  const big = evaluate(main, withSnack);
  assert.equal(big.status, 'accepted');
  if (big.status !== 'accepted') return;
  // The main keeps its 3 servings; a snack would need 9 of them, so it is not listed.
  assert.equal(big.servings, 3);
  assert.deepEqual(big.mealTypes, ['lunch', 'dinner']);

  const small = recipe([['120g', 'Chicken Breasts']]);
  const plain = evaluate(small, ctx);
  assert.equal(plain.status === 'rejected' && plain.reason, 'no_serving_fits');
  const snack = evaluate(small, withSnack);
  assert.equal(snack.status, 'accepted');
  if (snack.status !== 'accepted') return;
  assert.equal(snack.mealType, 'snack');
  assert.equal(snack.servings, 1);
});

test('a reviewed exclusion wins over every other rule', () => {
  const r = evaluate(
    recipe([
      ['500g', 'Chicken Breasts'],
      ['200g', 'Rice'],
    ]),
    {
      ...ctx,
      excluded: { mdb_1: 'wrong instructions' },
    },
  );
  assert.equal(r.status === 'rejected' && r.reason, 'excluded');
  assert.equal(r.status === 'rejected' && r.detail, 'wrong instructions');
});
