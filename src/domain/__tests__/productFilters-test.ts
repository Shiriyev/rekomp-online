import {
  applyProductFilters,
  countProductFilters,
  DEFAULT_PRODUCT_FILTERS,
  productCounts,
  sortProductList,
  type ProductFacts,
  type ProductFilters,
} from '../productFilters';

const p = (over: Partial<ProductFacts> & { id: string }): ProductFacts => ({
  name: over.id,
  category: 'other',
  subcategory: 'other',
  kcalPer100g: 100,
  proteinPer100g: 5,
  tags: [],
  quantity: null,
  low: false,
  uses: 0,
  ...over,
});

const chicken = p({
  id: 'chicken',
  name: 'Куриная грудка',
  category: 'meat_poultry',
  subcategory: 'chicken',
  kcalPer100g: 120,
  proteinPer100g: 23,
  quantity: 300,
  uses: 20,
});
const bacon = p({
  id: 'bacon',
  name: 'Бекон',
  category: 'meat_poultry',
  subcategory: 'pork',
  kcalPer100g: 540,
  proteinPer100g: 37,
  tags: ['pork'],
  uses: 3,
});
const skyr = p({
  id: 'skyr',
  name: 'Скир',
  category: 'dairy_eggs',
  subcategory: 'yogurt_skyr',
  kcalPer100g: 63,
  proteinPer100g: 11,
  tags: ['vegetarian', 'lactose'],
  quantity: 50,
  low: true,
  uses: 5,
});
const bread = p({
  id: 'bread',
  name: 'Хлеб',
  category: 'bread_bakery',
  subcategory: 'bread',
  kcalPer100g: 250,
  proteinPer100g: 9,
  tags: ['vegetarian', 'gluten'],
  quantity: 0,
});
const salt = p({ id: 'salt', name: 'Соль', kcalPer100g: 0, proteinPer100g: 0, tags: ['vegan'] });
const all = [chicken, bacon, skyr, bread, salt];

const ids = (items: ProductFacts[]) => items.map((i) => i.id);
const filters = (over: Partial<ProductFilters>): ProductFilters => ({
  ...DEFAULT_PRODUCT_FILTERS,
  ...over,
});
const apply = (over: Partial<ProductFilters>) =>
  ids(applyProductFilters(all, filters(over), (x) => x));

describe('applyProductFilters', () => {
  it('keeps everything with the defaults', () => {
    expect(apply({})).toEqual(ids(all));
  });

  it('filters by category and subcategory', () => {
    expect(apply({ category: 'meat_poultry' })).toEqual(['chicken', 'bacon']);
    expect(apply({ category: 'meat_poultry', subcategory: 'pork' })).toEqual(['bacon']);
  });

  it('filters by what is at home: some, none (0 counts as none), running low', () => {
    expect(apply({ stock: 'home' })).toEqual(['chicken', 'skyr']);
    expect(apply({ stock: 'missing' })).toEqual(['bacon', 'bread', 'salt']);
    expect(apply({ stock: 'low' })).toEqual(['skyr']);
  });

  it('filters by use in recipes, protein and kcal per 100 g', () => {
    expect(apply({ usedInRecipes: true })).toEqual(['chicken', 'bacon', 'skyr']);
    expect(apply({ highProtein: true })).toEqual(['chicken', 'bacon']);
    expect(apply({ kcal: 'upto100' })).toEqual(['skyr', 'salt']);
    expect(apply({ kcal: 'from100' })).toEqual(['chicken']);
    expect(apply({ kcal: 'from250' })).toEqual(['bread']);
    expect(apply({ kcal: 'from400' })).toEqual(['bacon']);
  });

  it('combines diet tags with AND', () => {
    expect(apply({ diets: ['no_pork'] })).toEqual(['chicken', 'skyr', 'bread', 'salt']);
    expect(apply({ diets: ['vegetarian'] })).toEqual(['skyr', 'bread']);
    expect(apply({ diets: ['vegetarian', 'no_lactose'] })).toEqual(['bread']);
    expect(apply({ diets: ['no_gluten', 'no_lactose', 'no_pork'] })).toEqual(['chicken', 'salt']);
  });
});

describe('countProductFilters', () => {
  it('counts the sheet filters only', () => {
    expect(countProductFilters(filters({ category: 'other', sort: 'kcal' }))).toBe(0);
    expect(
      countProductFilters(
        filters({
          stock: 'low',
          usedInRecipes: true,
          highProtein: true,
          kcal: 'upto100',
          diets: ['no_pork', 'vegetarian'],
        }),
      ),
    ).toBe(6);
  });
});

describe('productCounts', () => {
  it('counts categories under the sheet filters and subcategories of the chosen one', () => {
    const counts = productCounts(
      all,
      filters({ category: 'meat_poultry', diets: ['no_lactose'] }),
      (x) => x,
    );
    expect(counts.total).toBe(4);
    expect(Object.fromEntries(counts.categories)).toEqual({
      meat_poultry: 2,
      bread_bakery: 1,
      other: 1,
    });
    expect(Object.fromEntries(counts.subcategories)).toEqual({ chicken: 1, pork: 1 });
  });

  it('skips products without a subcategory', () => {
    const counts = productCounts(
      [p({ id: 'x', subcategory: null })],
      filters({ category: 'other' }),
      (x) => x,
    );
    expect(counts.subcategories.size).toBe(0);
  });
});

describe('sortProductList', () => {
  const sort = (s: ProductFilters['sort']) => ids(sortProductList(all, s, (x) => x));

  it('sorts by use in recipes, then name', () => {
    expect(sort('popular')).toEqual(['chicken', 'skyr', 'bacon', 'salt', 'bread']);
  });

  it('sorts by name', () => {
    expect(sort('name')).toEqual(['bacon', 'chicken', 'skyr', 'salt', 'bread']);
  });

  it('sorts by protein per 100 g and per 100 kcal, most first', () => {
    expect(sort('protein')).toEqual(['bacon', 'chicken', 'skyr', 'bread', 'salt']);
    // chicken 19.2, skyr 17.5, bacon 6.9, bread 3.6; salt has no kcal → last.
    expect(sort('proteinPerKcal')).toEqual(['chicken', 'skyr', 'bacon', 'bread', 'salt']);
  });

  it('sorts by kcal, fewest first', () => {
    expect(sort('kcal')).toEqual(['salt', 'skyr', 'chicken', 'bread', 'bacon']);
  });

  it('does not change the input', () => {
    const input = [...all];
    sortProductList(input, 'name', (x) => x);
    expect(input).toEqual(all);
  });
});
