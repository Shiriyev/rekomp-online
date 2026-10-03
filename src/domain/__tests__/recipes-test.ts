import { dayFit, recipeMeals, sortRecipes } from '../recipes';

const r = (id: string, kcal: number, protein: number, totalMinutes: number, sortOrder: number) => ({
  id,
  macros: { kcal, protein },
  totalMinutes,
  sortOrder,
});

const ITEMS = [r('a', 600, 40, 15, 0), r('b', 500, 50, 5, 1), r('c', 500, 40, 5, 2)];

describe('sortRecipes', () => {
  it('sorts by protein descending', () => {
    expect(sortRecipes(ITEMS, 'protein').map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by kcal ascending with catalog order as tie-breaker', () => {
    expect(sortRecipes(ITEMS, 'kcal').map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by time ascending', () => {
    expect(sortRecipes(ITEMS, 'time').map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by protein per 100 kcal, most first; no kcal last', () => {
    const items = [...ITEMS, r('d', 0, 0, 5, 3)];
    // a 6.7, b 10, c 8
    expect(sortRecipes(items, 'proteinPerKcal').map((x) => x.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('sorts by what fits the rest of the day', () => {
    // 520 kcal and 45 g left: b (500/50) is closest, then c (500/40), then a (600/40).
    expect(sortRecipes(ITEMS, 'fitsDay', { kcal: 520, protein: 45 }).map((x) => x.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    // Without what is left, the catalog order stays.
    expect(sortRecipes(ITEMS, 'fitsDay').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('measures the fit relative to what is left, floored when the day is nearly done', () => {
    expect(dayFit({ kcal: 500, protein: 40 }, { kcal: 500, protein: 40 })).toBe(0);
    expect(dayFit({ kcal: 600, protein: 40 }, { kcal: 500, protein: 20 })).toBeCloseTo(0.2 + 1);
    // Over the target: everything compares against 0 left, scaled by the floor.
    expect(dayFit({ kcal: 200, protein: 10 }, { kcal: -300, protein: -5 })).toBeCloseTo(2 + 1);
  });

  it('does not mutate the input', () => {
    sortRecipes(ITEMS, 'protein');
    expect(ITEMS.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('recipeMeals', () => {
  it('uses all fitting meals, else the primary one', () => {
    expect(recipeMeals({ mealType: 'lunch', mealTypes: ['lunch', 'dinner'] })).toEqual([
      'lunch',
      'dinner',
    ]);
    expect(recipeMeals({ mealType: 'snack', mealTypes: [] })).toEqual(['snack']);
    expect(recipeMeals({ mealType: 'snack' })).toEqual(['snack']);
  });
});
