import {
  applyRecipeFilters,
  buildShelves,
  countRecipeFilters,
  cuisinesOf,
  isNoCookRecipe,
  NO_RECIPE_FILTERS,
  proteinDensity,
  shelfRecipes,
  type BrowseRecipe,
  type RecipeFilter,
  type RecipeFilterState,
} from '../browse';

const r = (id: string, over: Partial<BrowseRecipe> = {}): BrowseRecipe => ({
  id,
  sortOrder: 0,
  totalMinutes: 30,
  ingredientCount: 6,
  isBatch: false,
  equipment: ['stove'],
  tags: [],
  mainProtein: 'poultry',
  cuisine: null,
  source: 'mealdb',
  macros: { kcal: 500, protein: 40 },
  missing: 3,
  favorite: false,
  ...over,
});

const ids = (rs: { id: string }[]) => rs.map((x) => x.id);

const state = (over: Partial<RecipeFilterState>): RecipeFilterState => ({
  ...NO_RECIPE_FILTERS,
  ...over,
});

describe('applyRecipeFilters', () => {
  const recipes = [
    r('stew', { equipment: ['stove', 'oven'], tags: ['pork', 'gluten'], totalMinutes: 60 }),
    r('salad', { equipment: [], tags: ['vegetarian', 'lactose'], totalMinutes: 10 }),
    r('smoothie', { equipment: ['blender'], tags: ['vegetarian'], totalMinutes: 5 }),
    r('cake', { equipment: ['oven', 'mixer', 'grill', 'microwave'], totalMinutes: 25 }),
  ];
  const run = (...toggles: RecipeFilter[]) => ids(applyRecipeFilters(recipes, state({ toggles })));

  it('keeps everything without filters', () => {
    expect(run()).toEqual(['stew', 'salad', 'smoothie', 'cake']);
  });

  it('drops recipes needing equipment the user does not have', () => {
    expect(run('no_stove')).toEqual(['salad', 'smoothie', 'cake']);
    expect(run('no_oven')).toEqual(['salad', 'smoothie']);
    expect(run('no_blender')).toEqual(['stew', 'salad', 'cake']);
    expect(run('no_mixer', 'no_grill', 'no_microwave')).toEqual(['stew', 'salad', 'smoothie']);
  });

  it('filters by diet, all filters together', () => {
    expect(run('vegetarian')).toEqual(['salad', 'smoothie']);
    expect(run('no_pork', 'no_gluten')).toEqual(['salad', 'smoothie', 'cake']);
    expect(run('no_lactose')).toEqual(['stew', 'smoothie', 'cake']);
  });

  it('filters by time and ingredient count (up to)', () => {
    expect(ids(applyRecipeFilters(recipes, state({ maxMinutes: 15 })))).toEqual([
      'salad',
      'smoothie',
    ]);
    expect(
      ids(applyRecipeFilters(recipes, state({ maxMinutes: 30, toggles: ['no_oven'] }))),
    ).toEqual(['salad', 'smoothie']);
    const few = [r('few', { ingredientCount: 5 }), r('many', { ingredientCount: 9 })];
    expect(ids(applyRecipeFilters(few, state({ maxIngredients: 5 })))).toEqual(['few']);
    expect(ids(applyRecipeFilters(few, state({ maxIngredients: 10 })))).toEqual(['few', 'many']);
  });

  it('filters by stock: cookable, at most 2 missing, batch', () => {
    const stock = [
      r('ready', { missing: 0 }),
      r('two', { missing: 2, isBatch: true }),
      r('three', { missing: 3 }),
    ];
    const f = (...toggles: RecipeFilter[]) => ids(applyRecipeFilters(stock, state({ toggles })));
    expect(f('cookable')).toEqual(['ready']);
    expect(f('almost')).toEqual(['ready', 'two']);
    expect(f('batch')).toEqual(['two']);
  });

  it('filters by kcal range, protein and protein per 100 kcal per serving', () => {
    const macros = [
      r('light', { macros: { kcal: 350, protein: 35 } }), // 10 g / 100 kcal
      r('mid', { macros: { kcal: 400, protein: 30 } }), // 7.5
      r('big', { macros: { kcal: 800, protein: 50 } }), // 6.25
      r('empty', { macros: { kcal: 0, protein: 0 } }),
    ];
    const f = (over: Partial<RecipeFilterState>) => ids(applyRecipeFilters(macros, state(over)));
    expect(f({ kcal: 'upto400' })).toEqual(['light', 'empty']);
    expect(f({ kcal: 'from400' })).toEqual(['mid']);
    expect(f({ kcal: 'from600' })).toEqual([]);
    expect(f({ kcal: 'from800' })).toEqual(['big']);
    expect(f({ minProtein: 30 })).toEqual(['light', 'mid', 'big']);
    expect(f({ minProtein: 40 })).toEqual(['big']);
    expect(f({ minDensity: 10 })).toEqual(['light']);
    expect(f({ minDensity: 8, minProtein: 40 })).toEqual([]);
  });

  it('filters by main protein and cuisine (any of), and by source', () => {
    const more = [
      r('fish', { mainProtein: 'fish', cuisine: 'Thai', source: 'own' }),
      r('beef', { mainProtein: 'beef', cuisine: 'British' }),
      r('plain', { mainProtein: 'eggs' }),
    ];
    const f = (over: Partial<RecipeFilterState>) => ids(applyRecipeFilters(more, state(over)));
    expect(f({ proteins: ['fish', 'beef'] })).toEqual(['fish', 'beef']);
    expect(f({ cuisines: ['Thai', 'British'] })).toEqual(['fish', 'beef']);
    expect(f({ cuisines: ['Thai'], proteins: ['beef'] })).toEqual([]);
    expect(f({ source: 'own' })).toEqual(['fish']);
    expect(f({ source: 'mealdb' })).toEqual(['beef', 'plain']);
  });
});

describe('countRecipeFilters / proteinDensity / cuisinesOf', () => {
  it('counts every active choice', () => {
    expect(countRecipeFilters(NO_RECIPE_FILTERS)).toBe(0);
    expect(
      countRecipeFilters(
        state({
          toggles: ['cookable', 'no_oven'],
          proteins: ['fish'],
          cuisines: ['Thai'],
          kcal: 'upto400',
          minProtein: 30,
          minDensity: 8,
          maxMinutes: 15,
          maxIngredients: 5,
          source: 'own',
        }),
      ),
    ).toBe(10);
  });

  it('computes protein per 100 kcal', () => {
    expect(proteinDensity({ kcal: 400, protein: 40 })).toBe(10);
    expect(proteinDensity({ kcal: 0, protein: 5 })).toBe(0);
  });

  it('lists cuisines by how many recipes have them, then by name', () => {
    expect(
      cuisinesOf([
        { cuisine: 'Thai' },
        { cuisine: null },
        { cuisine: 'British' },
        { cuisine: 'Thai' },
        { cuisine: 'Algerian' },
      ]),
    ).toEqual(['Thai', 'Algerian', 'British']);
  });
});

describe('shelves', () => {
  const recipes = [
    r('ready', { missing: 0, macros: { kcal: 500, protein: 30 } }),
    r('ready_more', { missing: 0, macros: { kcal: 500, protein: 50 } }),
    r('one_short', { missing: 1, mainProtein: 'fish' }),
    r('two_short', { missing: 2, mainProtein: 'fish', macros: { kcal: 500, protein: 60 } }),
    r('raw', { equipment: ['blender'], totalMinutes: 5, ingredientCount: 3, mainProtein: 'dairy' }),
    r('pot', { isBatch: true, totalMinutes: 90, mainProtein: 'beef' }),
  ];

  it('builds each shelf with its own order', () => {
    expect(ids(shelfRecipes(recipes, 'cookable'))).toEqual(['ready_more', 'ready']);
    expect(ids(shelfRecipes(recipes, 'almost'))).toEqual(['one_short', 'two_short']);
    expect(ids(shelfRecipes(recipes, 'no_cook'))).toEqual(['raw']);
    expect(ids(shelfRecipes(recipes, 'quick'))).toEqual(['raw']);
    expect(ids(shelfRecipes(recipes, 'batch'))).toEqual(['pot']);
    expect(ids(shelfRecipes(recipes, 'few_ingredients'))).toEqual(['raw']);
    expect(ids(shelfRecipes(recipes, 'fish'))).toEqual(['two_short', 'one_short']);
    expect(ids(shelfRecipes(recipes, 'protein')).slice(0, 2)).toEqual(['two_short', 'ready_more']);
  });

  it('keeps the catalog order on ties and the quickest first', () => {
    const tie = [r('b', { sortOrder: 2, missing: 0 }), r('a', { sortOrder: 1, missing: 0 })];
    expect(ids(shelfRecipes(tie, 'cookable'))).toEqual(['a', 'b']);
    const quick = [r('slow', { totalMinutes: 20 }), r('fast', { totalMinutes: 5 })];
    expect(ids(shelfRecipes(quick, 'quick'))).toEqual(['fast', 'slow']);
    const sameTime = [
      r('less', { totalMinutes: 10, macros: { kcal: 300, protein: 10 } }),
      r('more', { totalMinutes: 10, macros: { kcal: 300, protein: 20 } }),
    ];
    expect(ids(shelfRecipes(sameTime, 'quick'))).toEqual(['more', 'less']);
    const sameMissing = sameTime.map((x) => ({ ...x, missing: 1 }));
    expect(ids(shelfRecipes(sameMissing, 'almost'))).toEqual(['more', 'less']);
  });

  it('puts favourites first', () => {
    const withFav = [...recipes, r('fav', { favorite: true })];
    expect(buildShelves(withFav)[0]).toEqual({ shelf: 'favorites', recipes: [withFav.at(-1)] });
  });

  it('lists only non-empty shelves, in display order', () => {
    expect(buildShelves(recipes).map((s) => s.shelf)).toEqual([
      'cookable',
      'almost',
      'no_cook',
      'quick',
      'protein',
      'batch',
      'few_ingredients',
      'poultry',
      'fish',
      'beef',
      'dairy',
    ]);
  });

  it('knows a no-cook recipe', () => {
    expect(isNoCookRecipe({ equipment: ['blender', 'mixer'] })).toBe(true);
    expect(isNoCookRecipe({ equipment: ['microwave'] })).toBe(false);
  });
});
