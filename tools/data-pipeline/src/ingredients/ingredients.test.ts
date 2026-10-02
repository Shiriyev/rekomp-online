import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseMeasure } from './measure.ts';
import { normalizeName, singular } from './normalize.ts';

test('normalizeName strips preparation words, plurals and applies synonyms', () => {
  assert.equal(normalizeName('Finely Chopped Red Onions'), 'red onion');
  assert.equal(normalizeName('Eggs'), 'egg');
  assert.equal(normalizeName('Minced Beef'), 'ground beef');
  assert.equal(normalizeName('Minced Garlic'), 'garlic');
  assert.equal(normalizeName('Tomatoes'), 'tomato');
  assert.equal(normalizeName('Chickpeas'), 'chickpeas');
  assert.equal(normalizeName('Plain Flour', { 'plain flour': 'flour' }), 'flour');
  assert.equal(normalizeName('Crème Fraîche'), 'creme fraiche');
  assert.equal(normalizeName('Chicken Breasts (skinless)'), 'chicken breast');
  assert.equal(singular('berries'), 'berry');
  assert.equal(singular('leaves'), 'leaf');
  assert.equal(singular('asparagus'), 'asparagus');
});

test('parseMeasure handles weights, volumes, spoons, pieces and multipliers', () => {
  assert.deepEqual(parseMeasure('800g'), { kind: 'amount', quantity: 800, unit: 'g', size: null });
  assert.deepEqual(parseMeasure('1kg'), { kind: 'amount', quantity: 1000, unit: 'g', size: null });
  assert.deepEqual(parseMeasure('250ml'), {
    kind: 'amount',
    quantity: 250,
    unit: 'ml',
    size: null,
  });
  assert.deepEqual(parseMeasure('1 1/2 cups'), {
    kind: 'amount',
    quantity: 1.5,
    unit: 'cup',
    size: null,
  });
  assert.deepEqual(parseMeasure('2 tablespoons'), {
    kind: 'amount',
    quantity: 2,
    unit: 'tbsp',
    size: null,
  });
  assert.deepEqual(parseMeasure('1/2 tsp'), {
    kind: 'amount',
    quantity: 0.5,
    unit: 'tsp',
    size: null,
  });
  assert.deepEqual(parseMeasure('1 clove'), {
    kind: 'amount',
    quantity: 1,
    unit: 'clove',
    size: null,
  });
  assert.deepEqual(parseMeasure('3'), { kind: 'amount', quantity: 3, unit: 'piece', size: null });
  assert.deepEqual(parseMeasure('1 small finely diced'), {
    kind: 'amount',
    quantity: 1,
    unit: 'piece',
    size: 'small',
  });
  assert.deepEqual(parseMeasure('2 x 400g cans'), {
    kind: 'amount',
    quantity: 800,
    unit: 'g',
    size: null,
  });
  assert.deepEqual(parseMeasure('1 tin'), { kind: 'amount', quantity: 1, unit: 'can', size: null });
  assert.deepEqual(parseMeasure('2 tbs'), {
    kind: 'amount',
    quantity: 2,
    unit: 'tbsp',
    size: null,
  });
  assert.deepEqual(parseMeasure('1 tblsp'), {
    kind: 'amount',
    quantity: 1,
    unit: 'tbsp',
    size: null,
  });
  assert.deepEqual(parseMeasure('2 1/2 Tbs'), {
    kind: 'amount',
    quantity: 2.5,
    unit: 'tbsp',
    size: null,
  });
  assert.deepEqual(parseMeasure('1 Litre'), {
    kind: 'amount',
    quantity: 1000,
    unit: 'ml',
    size: null,
  });
  assert.deepEqual(parseMeasure('125g/4½oz'), {
    kind: 'amount',
    quantity: 125,
    unit: 'g',
    size: null,
  });
  assert.deepEqual(parseMeasure('1 knob'), {
    kind: 'amount',
    quantity: 1,
    unit: 'knob',
    size: null,
  });
  assert.deepEqual(parseMeasure('8 oz'), {
    kind: 'amount',
    quantity: 226.8,
    unit: 'g',
    size: null,
  });
});

test('parseMeasure treats unmeasured amounts as staples', () => {
  for (const m of ['Pinch', 'to taste', 'Garnish', '', 'dash', 'For frying', '5 drops']) {
    assert.deepEqual(parseMeasure(m), { kind: 'unquantified' }, m);
  }
});
