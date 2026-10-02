import { recipeMeals, sortRecipes } from '../recipes';

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
