import {
  applyRecipeFilters,
  buildShelves,
  isNoCookRecipe,
  shelfRecipes,
  type BrowseRecipe,
  type RecipeFilter,
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
  macros: { kcal: 500, protein: 40 },
  missing: 3,
  favorite: false,
  ...over,
});

const ids = (rs: { id: string }[]) => rs.map((x) => x.id);

describe('applyRecipeFilters', () => {
  const recipes = [
    r('stew', { equipment: ['stove', 'oven'], tags: ['pork', 'gluten'], totalMinutes: 60 }),
    r('salad', { equipment: [], tags: ['vegetarian', 'lactose'], totalMinutes: 10 }),
    r('smoothie', { equipment: ['blender'], tags: ['vegetarian'], totalMinutes: 5 }),
    r('cake', { equipment: ['oven', 'mixer', 'grill', 'microwave'], totalMinutes: 25 }),
  ];
  const run = (...f: RecipeFilter[]) => ids(applyRecipeFilters(recipes, new Set(f)));

  it('keeps everything without filters', () => {
    expect(run()).toEqual(['stew', 'salad', 'smoothie', 'cake']);
  });

  it('drops recipes needing equipment the user does not have', () => {
    expect(run('no_stove')).toEqual(['salad', 'smoothie', 'cake']);
    expect(run('no_oven')).toEqual(['salad', 'smoothie']);
    expect(run('no_blender')).toEqual(['stew', 'salad', 'cake']);
    expect(run('no_mixer', 'no_grill', 'no_microwave')).toEqual(['stew', 'salad', 'smoothie']);
  });

  it('filters by diet and time, all filters together', () => {
    expect(run('vegetarian')).toEqual(['salad', 'smoothie']);
    expect(run('no_pork', 'no_gluten')).toEqual(['salad', 'smoothie', 'cake']);
    expect(run('no_lactose')).toEqual(['stew', 'smoothie', 'cake']);
    expect(run('quick15')).toEqual(['salad', 'smoothie']);
    expect(run('quick30', 'no_oven')).toEqual(['salad', 'smoothie']);
  });

  it('filters by stock, protein and size, and by main protein (any of)', () => {
    const more = [
      r('ready', { missing: 0, macros: { kcal: 500, protein: 45 }, ingredientCount: 4 }),
      r('fish', { mainProtein: 'fish', macros: { kcal: 500, protein: 20 } }),
      r('beef', { mainProtein: 'beef', macros: { kcal: 500, protein: 30 } }),
    ];
    const f = (active: RecipeFilter[], proteins: string[] = []) =>
      ids(applyRecipeFilters(more, new Set(active), new Set(proteins)));
    expect(f(['cookable'])).toEqual(['ready']);
    expect(f(['protein40'])).toEqual(['ready']);
    expect(f(['few_ingredients'])).toEqual(['ready']);
    expect(f([], ['fish', 'beef'])).toEqual(['fish', 'beef']);
    expect(f(['protein40'], ['fish'])).toEqual([]);
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
