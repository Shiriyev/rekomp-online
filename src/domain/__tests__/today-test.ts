import {
  catalogMacros,
  kcalRangeByMeal,
  proteinNudge,
  recentPresets,
  remaining,
  suggestMealType,
  summarizeDay,
} from '../today';
import type { NutritionIngredient, RecipeLine } from '../types';

const at = (h: number, m = 0) => new Date(2026, 8, 27, h, m);

describe('summarizeDay', () => {
  it('sums totals and per meal type', () => {
    const s = summarizeDay([
      { mealType: 'breakfast', kcal: 620, protein: 49 },
      { mealType: 'snack', kcal: 250, protein: 4.3 },
      { mealType: 'snack', kcal: 175, protein: 16 },
    ]);
    expect(s.total).toEqual({ kcal: 1045, protein: 69.3 });
    expect(s.byMeal.snack).toEqual({ kcal: 425, protein: 20.3 });
    expect(s.byMeal.lunch).toEqual({ kcal: 0, protein: 0 });
  });

  it('is all zeros for an empty day', () => {
    expect(summarizeDay([]).total).toEqual({ kcal: 0, protein: 0 });
  });
});

describe('remaining', () => {
  const targets = { kcalTarget: 2150, proteinTargetG: 140, proteinMinG: 120 };

  it('reports what is left', () => {
    expect(remaining({ kcal: 1500, protein: 100 }, targets)).toEqual({
      kcal: 650,
      proteinToTarget: 40,
      proteinToMin: 20,
    });
  });

  it('goes negative on kcal but clamps protein at zero', () => {
    expect(remaining({ kcal: 2300, protein: 150 }, targets)).toEqual({
      kcal: -150,
      proteinToTarget: 0,
      proteinToMin: 0,
    });
  });
});

describe('suggestMealType', () => {
  it.each([
    [7, 'breakfast'],
    [10, 'breakfast'],
    [11, 'lunch'],
    [15, 'lunch'],
    [16, 'snack'],
    [17, 'snack'],
    [18, 'dinner'],
    [23, 'dinner'],
    [0, 'dinner'],
    [2, 'snack'],
  ] as const)('%i:00 → %s', (hour, meal) => {
    expect(suggestMealType(at(hour))).toBe(meal);
  });
});

describe('proteinNudge', () => {
  it('is silent before 17:00', () => {
    expect(proteinNudge(at(16, 59), 40, 120)).toBeNull();
  });

  it('rounds the missing amount up to 5 g in the evening', () => {
    expect(proteinNudge(at(17), 97, 120)).toBe(25);
    expect(proteinNudge(at(21), 100, 120)).toBe(20);
  });

  it('ignores small gaps and met minimums', () => {
    expect(proteinNudge(at(20), 111, 120)).toBeNull();
    expect(proteinNudge(at(20), 130, 120)).toBeNull();
  });
});

describe('recentPresets', () => {
  const p = (name: string, kcal = 100) => ({ name, kcal, protein: 1, mealType: 'snack' as const });

  it('dedupes by name ignoring case/spaces and keeps the newest', () => {
    expect(recentPresets([p('Сникерс', 250), p('сникерс ', 240), p('Кофе', 30)])).toEqual([
      p('Сникерс', 250),
      p('Кофе', 30),
    ]);
  });

  it('respects the limit', () => {
    expect(recentPresets([p('a'), p('b'), p('c')], 2).map((x) => x.name)).toEqual(['a', 'b']);
  });
});

describe('catalogMacros / kcalRangeByMeal', () => {
  const ingredients = new Map<string, NutritionIngredient>([
    [
      'a',
      {
        id: 'a',
        unit: 'g',
        gramsPerPiece: null,
        kcalPer100g: 100,
        proteinPer100g: 10,
        isStaple: false,
      },
    ],
  ]);
  const line = (recipeId: string, amount: number): RecipeLine & { recipeId: string } => ({
    recipeId,
    ingredientId: 'a',
    amountPerServing: amount,
    unit: 'g',
    optional: false,
    altGroup: null,
    sortOrder: 0,
  });
  const recipes = [
    { id: 'Z1', mealType: 'breakfast' as const },
    { id: 'Z2', mealType: 'breakfast' as const },
    { id: 'P1', mealType: 'snack' as const },
    { id: 'EMPTY', mealType: 'dinner' as const },
  ];

  it('computes per-serving macros per recipe', () => {
    const m = catalogMacros(
      recipes,
      [line('Z1', 500), line('Z2', 300), line('P1', 150)],
      ingredients,
    );
    expect(m.get('Z1')).toEqual({ kcal: 500, protein: 50 });
    expect(m.get('EMPTY')).toEqual({ kcal: 0, protein: 0 });
  });

  it('sums several lines of the same recipe', () => {
    const lines = [line('Z1', 200), { ...line('Z1', 100), sortOrder: 1 }];
    expect(catalogMacros(recipes, lines, ingredients).get('Z1')).toEqual({
      kcal: 300,
      protein: 30,
    });
  });

  it('spans min–max kcal per meal type', () => {
    const m = catalogMacros(
      recipes,
      [line('Z1', 500), line('Z2', 300), line('P1', 150)],
      ingredients,
    );
    expect(kcalRangeByMeal(recipes, m)).toEqual({
      breakfast: { min: 300, max: 500 },
      snack: { min: 150, max: 150 },
      dinner: { min: 0, max: 0 },
    });
    expect(kcalRangeByMeal(recipes, new Map())).toEqual({});
  });
});
