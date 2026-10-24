import assert from 'node:assert/strict';
import { test } from 'node:test';

import { prune, type PruneLists, type PruneRecipe } from './prune.ts';

const options = {
  minRecipeUses: 3,
  cascade: false,
  grillWords: ['grill', 'griddle', 'barbecue', 'bbq', 'broil', 'skewer', 'грил', 'шампур'],
  notAdaptableWords: ['barbecue', 'bbq', 'skewer', 'шампур'],
};
const lists = (over: Partial<PruneLists> = {}): PruneLists => ({
  ingredientAllow: new Set(['onion', 'salt']),
  ingredientShops: new Set(),
  ingredientBlock: new Set(),
  recipeAllow: new Set(),
  recipeBlock: new Set(),
  ...over,
});
const recipe = (
  id: string,
  products: string[],
  over: Partial<PruneRecipe> = {},
  optional: string[] = [],
): PruneRecipe => ({
  id,
  nameEn: id,
  mealTypes: ['lunch'],
  text: id,
  equipment: ['stove'],
  lines: [
    ...products.map((ingredientId) => ({ ingredientId, mandatory: true })),
    ...optional.map((ingredientId) => ({ ingredientId, mandatory: false })),
  ],
  protected: false,
  ...over,
});
const ALL = ['onion', 'salt', 'chicken', 'rice', 'tamarind', 'basil', 'squid', 'unused'];
const common = () => [
  recipe('a', ['chicken', 'rice', 'onion']),
  recipe('b', ['chicken', 'rice']),
  recipe('c', ['chicken', 'rice', 'salt']),
];

test('removes grill dishes and flags the ones a pan could do', () => {
  const r = prune(
    [
      ...common(),
      recipe('g1', ['chicken'], { text: 'Grilled chicken. Grill for 10 minutes.' }),
      recipe('g2', ['chicken'], { text: 'Chicken skewers on the barbecue' }),
      recipe('g3', ['chicken'], { equipment: ['grill'] }),
      recipe('g4', ['chicken'], { text: 'Курица на гриле' }),
    ],
    ALL,
    lists(),
    options,
  );
  const reasons = Object.fromEntries(r.removedRecipes.map((x) => [x.id, x.reason]));
  assert.deepEqual(reasons.g1, { kind: 'grill', match: 'grill', adaptable: true });
  assert.deepEqual(reasons.g2, { kind: 'grill', match: 'skewer', adaptable: false });
  assert.deepEqual(reasons.g3, { kind: 'grill', match: 'grill', adaptable: true });
  assert.deepEqual(reasons.g4, { kind: 'grill', match: 'грил', adaptable: true });
  assert.deepEqual([...r.keptRecipes], ['a', 'b', 'c']);
});

test('a barbecue sauce is a product, not a grill', () => {
  const r = prune(
    [...common(), recipe('d', ['chicken', 'rice'], { text: 'Spread BBQ sauce over the loaf' })],
    ALL,
    lists(),
    { ...options, grillIgnore: ['(barbecue|bbq) sauce'] },
  );
  assert.ok(r.keptRecipes.has('d'));
});

test('a word inside another word is not a grill', () => {
  const r = prune(
    [...common(), recipe('d', ['chicken', 'rice'], { text: 'Sgrillo' })],
    ALL,
    lists(),
    options,
  );
  assert.ok(r.keptRecipes.has('d'));
});

test('removes dishes with a mandatory rare product, drops optional rare lines', () => {
  const r = prune(
    [
      recipe('a', ['chicken', 'rice'], {}, ['basil']),
      recipe('b', ['chicken', 'rice', 'tamarind']),
      recipe('c', ['chicken', 'rice']),
      recipe('d', ['chicken', 'rice']),
    ],
    ALL,
    lists(),
    options,
  );
  assert.deepEqual(r.removedRecipes, [
    {
      id: 'b',
      nameEn: 'b',
      mealTypes: ['lunch'],
      reason: { kind: 'rare', products: [{ id: 'tamarind', uses: 1 }] },
    },
  ]);
  assert.deepEqual([...r.droppedLines], [['a', ['basil']]]);
  assert.equal(r.uses.get('chicken'), 3);
  assert.ok(!r.uses.has('basil'));
});

test('counts once by default: a product stays at its first count', () => {
  const r = prune(
    [
      ...common(),
      recipe('s1', ['squid', 'rice']),
      recipe('s2', ['squid', 'chicken']),
      recipe('s3', ['squid', 'tamarind']),
    ],
    ALL,
    lists(),
    options,
  );
  assert.deepEqual([...r.keptRecipes].sort(), ['a', 'b', 'c', 's1', 's2']);
  assert.equal(r.counted.get('squid'), 3);
  assert.equal(r.uses.get('squid'), 2);
});

test('with cascade, removing a dish can make another product rare', () => {
  // squid is in 3 dishes, but one of them goes for tamarind → squid drops to 2.
  const r = prune(
    [
      ...common(),
      recipe('s1', ['squid', 'rice']),
      recipe('s2', ['squid', 'chicken']),
      recipe('s3', ['squid', 'tamarind']),
    ],
    ALL,
    lists(),
    { ...options, cascade: true },
  );
  assert.deepEqual([...r.keptRecipes].sort(), ['a', 'b', 'c']);
  const s1 = r.removedRecipes.find((x) => x.id === 's1');
  assert.deepEqual(s1?.reason, { kind: 'rare', products: [{ id: 'squid', uses: 2 }] });
});

test('keeps allowlisted products and drops products no dish uses', () => {
  const r = prune(common(), ALL, lists(), options);
  assert.deepEqual([...r.keptProducts].sort(), ['chicken', 'onion', 'rice', 'salt']);
  assert.deepEqual(r.removedProducts, ['tamarind', 'basil', 'squid', 'unused']);
});

test('a product sold at Lidl is not rare', () => {
  const r = prune(
    [...common(), recipe('t', ['chicken', 'tamarind'])],
    ALL,
    lists({ ingredientShops: new Set(['tamarind']) }),
    options,
  );
  assert.ok(r.keptRecipes.has('t'));
  assert.ok(r.keptProducts.has('tamarind'));
});

test('the product blocklist makes a product rare however often it is used', () => {
  const r = prune(common(), ALL, lists({ ingredientBlock: new Set(['rice']) }), options);
  assert.deepEqual([...r.keptRecipes], []);
  assert.throws(() =>
    prune(common(), ALL, lists({ ingredientBlock: new Set(['onion']) }), options),
  );
});

test('manual recipe lists win; protected recipes are never touched', () => {
  const r = prune(
    [
      ...common(),
      recipe('grilled', ['chicken'], { text: 'grill it' }),
      recipe('blocked', ['chicken', 'rice']),
      recipe('v1', ['tamarind'], { protected: true }, ['squid']),
    ],
    ALL,
    lists({ recipeAllow: new Set(['grilled']), recipeBlock: new Set(['blocked']) }),
    options,
  );
  assert.deepEqual([...r.keptRecipes].sort(), ['a', 'b', 'c', 'grilled', 'v1']);
  assert.deepEqual(
    r.removedRecipes.map((x) => [x.id, x.reason.kind]),
    [['blocked', 'blocklist']],
  );
  // The protected dish keeps its rare products and lines.
  assert.ok(r.keptProducts.has('tamarind') && r.keptProducts.has('squid'));
  assert.equal(r.droppedLines.size, 0);
  assert.throws(() =>
    prune(
      common(),
      ALL,
      lists({ recipeAllow: new Set(['a']), recipeBlock: new Set(['a']) }),
      options,
    ),
  );
});

test('lists dishes that passed with no margin', () => {
  const r = prune([...common(), recipe('d', ['chicken', 'onion'])], ALL, lists(), options);
  // chicken is used 4 times, rice exactly 3 times.
  assert.deepEqual(
    r.borderline.map((b) => [b.id, b.products]),
    [
      ['a', [{ id: 'rice', uses: 3 }]],
      ['b', [{ id: 'rice', uses: 3 }]],
      ['c', [{ id: 'rice', uses: 3 }]],
    ],
  );
});
