import { stepIngredients } from '../cooking';
import { recipeMacros } from '../nutrition';
import { canCook, type PantryStock } from '../pantry';
import {
  amountSnapshot,
  applyAmounts,
  draftStep,
  isRemoved,
  normalizeDraftAmount,
  sanitizeAmounts,
  setDraftAmount,
  usedAmounts,
} from '../recipeDraft';
import type { NutritionIngredient, RecipeLine } from '../types';

const ingredients = new Map<string, NutritionIngredient>([
  [
    'tvorog',
    {
      id: 'tvorog',
      unit: 'g',
      gramsPerPiece: null,
      kcalPer100g: 130,
      proteinPer100g: 17,
      isStaple: false,
    },
  ],
  [
    'banana',
    {
      id: 'banana',
      unit: 'pcs',
      gramsPerPiece: 120,
      kcalPer100g: 89,
      proteinPer100g: 1.1,
      isStaple: false,
    },
  ],
  [
    'skyr',
    {
      id: 'skyr',
      unit: 'g',
      gramsPerPiece: null,
      kcalPer100g: 63,
      proteinPer100g: 11,
      isStaple: false,
    },
  ],
  [
    'yogurt',
    {
      id: 'yogurt',
      unit: 'g',
      gramsPerPiece: null,
      kcalPer100g: 70,
      proteinPer100g: 9,
      isStaple: false,
    },
  ],
  [
    'salt',
    {
      id: 'salt',
      unit: 'g',
      gramsPerPiece: null,
      kcalPer100g: 0,
      proteinPer100g: 0,
      isStaple: true,
    },
  ],
]);

const line = (
  ingredientId: string,
  amountPerServing: number,
  over: Partial<RecipeLine> = {},
): RecipeLine => ({
  ingredientId,
  amountPerServing,
  unit: ingredients.get(ingredientId)!.unit,
  optional: false,
  altGroup: null,
  sortOrder: 0,
  ...over,
});

// Z1-like: творог 250 г + банан 1 шт (+ соль).
const lines = [
  line('tvorog', 250, { sortOrder: 0 }),
  line('banana', 1, { sortOrder: 1 }),
  line('salt', 1, { sortOrder: 2 }),
];

describe('applyAmounts', () => {
  it('replaces only the given amounts and never touches the recipe', () => {
    const drafted = applyAmounts(lines, { tvorog: 200 });
    expect(drafted.map((l) => l.amountPerServing)).toEqual([200, 1, 1]);
    expect(lines[0]!.amountPerServing).toBe(250);
  });
});

describe('macros follow the draft', () => {
  it('recalculates on a changed amount', () => {
    const base = recipeMacros(lines, ingredients).perServing;
    const drafted = recipeMacros(applyAmounts(lines, { tvorog: 200 }), ingredients).perServing;
    expect(base.kcal - drafted.kcal).toBeCloseTo(65);
    expect(base.protein - drafted.protein).toBeCloseTo(8.5);
  });

  it('drops a zeroed ingredient (banana removed)', () => {
    const drafted = applyAmounts(lines, { banana: 0 });
    expect(recipeMacros(drafted, ingredients).perServing.kcal).toBeCloseTo(325);
    expect(isRemoved(drafted[1]!)).toBe(true);
    expect(isRemoved(drafted[0]!)).toBe(false);
  });

  it('scales per-serving amounts by servings', () => {
    const m = recipeMacros(applyAmounts(lines, { tvorog: 220 }), ingredients, { servings: 3 });
    expect(m.total.kcal).toBeCloseTo(m.perServing.kcal * 3);
    expect(usedAmounts(applyAmounts(lines, { tvorog: 220 }), ingredients, 3, {})[0]).toEqual({
      ingredientId: 'tvorog',
      amount: 660,
      unit: 'g',
    });
  });
});

describe('canCook with drafted amounts', () => {
  const pantry: PantryStock = new Map([['tvorog', { quantity: 200, unit: 'g' }]]);

  it('is ok with less творог and the banana removed', () => {
    expect(canCook(lines, ingredients, pantry, 1).status).toBe('partial');
    const check = canCook(applyAmounts(lines, { tvorog: 200, banana: 0 }), ingredients, pantry, 1);
    expect(check.status).toBe('ok');
    expect(check.missing).toEqual([]);
    expect(check.lines.map((c) => c.line.ingredientId)).toEqual(['tvorog']);
  });

  it('asks for more when the amount goes up', () => {
    const check = canCook(applyAmounts(lines, { tvorog: 300, banana: 0 }), ingredients, pantry, 1);
    expect(check.missing).toEqual([{ ingredientId: 'tvorog', amount: 100, unit: 'g' }]);
  });
});

describe('steps show the drafted grams', () => {
  it('uses changed amounts and hides removed ingredients', () => {
    const drafted = applyAmounts(lines, { tvorog: 200, banana: 0 });
    expect(stepIngredients(['tvorog', 'banana', 'salt'], drafted, ingredients, 2, {})).toEqual([
      { ingredientId: 'tvorog', amount: 400, unit: 'g' },
      { ingredientId: 'salt', amount: null, unit: 'g' },
    ]);
  });
});

describe('draft editing helpers', () => {
  it('steps 10 g / 10 ml / 1 шт and keeps half pieces', () => {
    expect([draftStep('g'), draftStep('ml'), draftStep('pcs')]).toEqual([10, 10, 1]);
    expect(normalizeDraftAmount(0.4, 'pcs')).toBe(0.5);
    expect(normalizeDraftAmount(204.6, 'g')).toBe(205);
    expect(normalizeDraftAmount(-5, 'g')).toBe(0);
    expect(normalizeDraftAmount(Number.NaN, 'g')).toBe(0);
  });

  it('drops values equal to the recipe (reset = empty draft)', () => {
    const changed = setDraftAmount({}, 'tvorog', 200, 250, 'g');
    expect(changed).toEqual({ tvorog: 200 });
    expect(setDraftAmount(changed, 'tvorog', 250, 250, 'g')).toEqual({});
    expect(setDraftAmount(changed, 'banana', 0, 1, 'pcs')).toEqual({ tvorog: 200, banana: 0 });
  });

  it('snapshots every line', () => {
    expect(amountSnapshot(applyAmounts(lines, { tvorog: 200 }))).toEqual({
      tvorog: 200,
      banana: 1,
      salt: 1,
    });
  });

  it('sanitizes stored or passed amounts', () => {
    expect(
      sanitizeAmounts(
        { tvorog: 200, banana: -1, salt: 'x', ghost: 5, skyr: Number.POSITIVE_INFINITY },
        [...lines, line('skyr', 100)],
      ),
    ).toEqual({ tvorog: 200 });
  });
});

describe('usedAmounts', () => {
  it('lists the chosen alternative only, without staples or removed lines', () => {
    const withAlt = [
      line('skyr', 150, { altGroup: 'y', sortOrder: 0 }),
      line('yogurt', 150, { altGroup: 'y', sortOrder: 1 }),
      line('banana', 0, { sortOrder: 2 }),
      line('salt', 1, { sortOrder: 3 }),
    ];
    expect(usedAmounts(withAlt, ingredients, 1, { y: 'yogurt' })).toEqual([
      { ingredientId: 'yogurt', amount: 150, unit: 'g' },
    ]);
    // Unknown ingredients are skipped rather than failing the finish.
    const ghost: RecipeLine = { ...line('tvorog', 10), ingredientId: 'ghost' };
    expect(usedAmounts([ghost], ingredients, 1, {})).toEqual([]);
  });
});
