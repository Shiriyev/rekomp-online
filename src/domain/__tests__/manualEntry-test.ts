import {
  deductionMacros,
  deductionStep,
  defaultDeductionAmount,
  planManualDeduction,
} from '../manualEntry';
import type { PantryStock } from '../pantry';
import type { NutritionIngredient } from '../types';

const ing = (
  id: string,
  unit: NutritionIngredient['unit'],
  extra: Partial<NutritionIngredient> = {},
) =>
  ({
    id,
    unit,
    gramsPerPiece: unit === 'pcs' ? 120 : null,
    kcalPer100g: 100,
    proteinPer100g: 10,
    isStaple: false,
    ...extra,
  }) satisfies NutritionIngredient;

const ingredients = new Map<string, NutritionIngredient>([
  ['tvorog', ing('tvorog', 'g', { kcalPer100g: 130, proteinPer100g: 17 })],
  ['milk', ing('milk', 'ml', { kcalPer100g: 50, proteinPer100g: 3.3 })],
  ['banana', ing('banana', 'pcs', { kcalPer100g: 89, proteinPer100g: 1.1 })],
]);

describe('deductionStep / defaultDeductionAmount', () => {
  it('steps 50 g, 10 ml, 1 шт', () => {
    expect([deductionStep('g'), deductionStep('ml'), deductionStep('pcs')]).toEqual([50, 10, 1]);
  });

  it('starts at a typical portion, capped by what is at home', () => {
    expect(defaultDeductionAmount('g', 350)).toBe(100);
    expect(defaultDeductionAmount('g', 60)).toBe(60);
    expect(defaultDeductionAmount('pcs', 0.5)).toBe(0.5);
    expect(defaultDeductionAmount('pcs', 0)).toBe(1);
  });
});

describe('planManualDeduction', () => {
  const pantry: PantryStock = new Map([
    ['tvorog', { quantity: 350, unit: 'g' }],
    ['banana', { quantity: 1, unit: 'pcs' }],
    // Stored in grams although the ingredient counts pieces (older rows).
    ['milk', { quantity: 500, unit: 'ml' }],
  ]);

  it('takes several products and shows what remains', () => {
    const plan = planManualDeduction(
      [
        { ingredientId: 'tvorog', amount: 150 },
        { ingredientId: 'milk', amount: 200 },
      ],
      ingredients,
      pantry,
    );
    expect(plan.lines).toEqual([
      { ingredientId: 'tvorog', unit: 'g', amount: 150, available: 350, taken: 150, after: 200 },
      { ingredientId: 'milk', unit: 'ml', amount: 200, available: 500, taken: 200, after: 300 },
    ]);
    expect(plan.take).toEqual([
      { ingredientId: 'tvorog', amount: 150, unit: 'g' },
      { ingredientId: 'milk', amount: 200, unit: 'ml' },
    ]);
  });

  it('clamps at zero and records only what was really taken', () => {
    const plan = planManualDeduction([{ ingredientId: 'banana', amount: 3 }], ingredients, pantry);
    expect(plan.lines[0]).toMatchObject({ taken: 1, after: 0 });
    expect(plan.take).toEqual([{ ingredientId: 'banana', amount: 1, unit: 'pcs' }]);
  });

  it('merges duplicates, skips empty amounts and products not at home', () => {
    const plan = planManualDeduction(
      [
        { ingredientId: 'tvorog', amount: 100 },
        { ingredientId: 'tvorog', amount: 50 },
        { ingredientId: 'milk', amount: 0 },
        { ingredientId: 'milk', amount: Number.NaN },
      ],
      ingredients,
      new Map([['tvorog', { quantity: 350, unit: 'g' }]]),
    );
    expect(plan.take).toEqual([{ ingredientId: 'tvorog', amount: 150, unit: 'g' }]);

    const none = planManualDeduction(
      [{ ingredientId: 'banana', amount: 1 }],
      ingredients,
      new Map(),
    );
    expect(none.lines[0]).toMatchObject({ available: 0, taken: 0, after: 0 });
    expect(none.take).toEqual([]);
  });

  it('converts stock stored in another unit', () => {
    const plan = planManualDeduction(
      [{ ingredientId: 'banana', amount: 1 }],
      ingredients,
      new Map([['banana', { quantity: 240, unit: 'g' }]]),
    );
    expect(plan.lines[0]).toMatchObject({ available: 2, after: 1 });
  });

  it('fails on unknown products', () => {
    expect(() =>
      planManualDeduction([{ ingredientId: 'ghost', amount: 1 }], ingredients, pantry),
    ).toThrow('Unknown ingredient');
  });
});

describe('deductionMacros', () => {
  it('sums kcal and protein of what was eaten, rounded', () => {
    expect(
      deductionMacros(
        [
          { ingredientId: 'tvorog', amount: 150 },
          { ingredientId: 'banana', amount: 1 },
          { ingredientId: 'milk', amount: 0 },
        ],
        ingredients,
      ),
    ).toEqual({ kcal: 302, protein: 26.8 });
    expect(deductionMacros([], ingredients)).toEqual({ kcal: 0, protein: 0 });
  });

  it('fails on unknown products', () => {
    expect(() => deductionMacros([{ ingredientId: 'ghost', amount: 1 }], ingredients)).toThrow();
  });
});
