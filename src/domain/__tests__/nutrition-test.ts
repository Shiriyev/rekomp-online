import {
  ingredientMacros,
  MissingIngredientError,
  recipeMacros,
  resolveLines,
  roundKcal,
  roundProtein,
} from '../nutrition';
import type { NutritionIngredient, RecipeLine } from '../types';

const ing = (over: Partial<NutritionIngredient> & { id: string }): NutritionIngredient => ({
  unit: 'g',
  gramsPerPiece: null,
  kcalPer100g: 100,
  proteinPer100g: 10,
  isStaple: false,
  ...over,
});

const line = (over: Partial<RecipeLine> & { ingredientId: string }): RecipeLine => ({
  amountPerServing: 100,
  unit: 'g',
  optional: false,
  altGroup: null,
  sortOrder: 0,
  ...over,
});

const INGREDIENTS = new Map<string, NutritionIngredient>(
  [
    ing({ id: 'tvorog', kcalPer100g: 130, proteinPer100g: 17 }),
    ing({ id: 'skyr', kcalPer100g: 63, proteinPer100g: 11 }),
    ing({ id: 'greek', kcalPer100g: 70, proteinPer100g: 9 }),
    ing({ id: 'egg', unit: 'pcs', gramsPerPiece: 55, kcalPer100g: 143, proteinPer100g: 12.6 }),
    ing({ id: 'salt', kcalPer100g: 0, proteinPer100g: 0, isStaple: true }),
  ].map((i) => [i.id, i]),
);

describe('ingredientMacros', () => {
  it('scales per-100g values by grams', () => {
    expect(ingredientMacros(INGREDIENTS.get('tvorog')!, 250, 'g')).toEqual({
      kcal: 325,
      protein: 42.5,
    });
  });

  it('uses gramsPerPiece for pieces', () => {
    const m = ingredientMacros(INGREDIENTS.get('egg')!, 2, 'pcs');
    expect(m.kcal).toBeCloseTo(157.3, 5);
    expect(m.protein).toBeCloseTo(13.86, 5);
  });

  it('counts staples as zero regardless of stored values or amount', () => {
    const weirdSalt = ing({ id: 'salt', isStaple: true, kcalPer100g: 999 });
    expect(ingredientMacros(weirdSalt, 5, 'g')).toEqual({ kcal: 0, protein: 0 });
  });
});

describe('resolveLines', () => {
  const lines = [
    line({ ingredientId: 'greek', altGroup: 'yogurt', sortOrder: 2 }),
    line({ ingredientId: 'skyr', altGroup: 'yogurt', sortOrder: 1 }),
    line({ ingredientId: 'tvorog', sortOrder: 0 }),
    line({ ingredientId: 'egg', unit: 'pcs', amountPerServing: 1, optional: true, sortOrder: 3 }),
  ];

  it('keeps required lines and the lowest-sortOrder alternative, drops optional ones', () => {
    expect(resolveLines(lines).map((l) => l.ingredientId)).toEqual(['tvorog', 'skyr']);
  });

  it('honours an explicit choice within a group', () => {
    expect(resolveLines(lines, { yogurt: 'greek' }).map((l) => l.ingredientId)).toEqual([
      'tvorog',
      'greek',
    ]);
  });

  it('falls back to the default when the choice is not in the group', () => {
    expect(resolveLines(lines, { yogurt: 'tvorog' }).map((l) => l.ingredientId)).toEqual([
      'tvorog',
      'skyr',
    ]);
  });
});

describe('recipeMacros', () => {
  const lines = [
    line({ ingredientId: 'tvorog', amountPerServing: 100, sortOrder: 0 }),
    line({ ingredientId: 'skyr', amountPerServing: 150, altGroup: 'y', sortOrder: 1 }),
    line({ ingredientId: 'greek', amountPerServing: 150, altGroup: 'y', sortOrder: 2 }),
    line({ ingredientId: 'salt', amountPerServing: 0, sortOrder: 3 }),
  ];

  it('sums per serving and multiplies by servings', () => {
    const m = recipeMacros(lines, INGREDIENTS, { servings: 3 });
    expect(m.perServing.kcal).toBeCloseTo(130 + 94.5, 5);
    expect(m.perServing.protein).toBeCloseTo(17 + 16.5, 5);
    expect(m.total.kcal).toBeCloseTo((130 + 94.5) * 3, 5);
  });

  it('defaults to one serving and respects alternative choices', () => {
    const m = recipeMacros(lines, INGREDIENTS, { choices: { y: 'greek' } });
    expect(m.total).toEqual(m.perServing);
    expect(m.perServing.kcal).toBeCloseTo(130 + 105, 5);
  });

  it.each([0, -1, Number.NaN])('rejects servings %p', (servings) => {
    expect(() => recipeMacros(lines, INGREDIENTS, { servings })).toThrow(RangeError);
  });

  it('throws on unknown ingredients instead of silently ignoring them', () => {
    expect(() => recipeMacros([line({ ingredientId: 'ghost' })], INGREDIENTS)).toThrow(
      MissingIngredientError,
    );
  });
});

describe('rounding', () => {
  it('rounds kcal to integers and protein to 0.1', () => {
    expect(roundKcal(540.65)).toBe(541);
    expect(roundProtein(30.84)).toBe(30.8);
    expect(roundProtein(30.85)).toBe(30.9);
  });
});
