import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectEquipment, isNoCook } from './equipment.ts';

test('reads the equipment from the steps', () => {
  assert.deepEqual(detectEquipment(['Fry the onion in a pan.', 'Bake for 20 minutes.']), [
    'stove',
    'oven',
  ]);
  assert.deepEqual(detectEquipment(['Blend the milk, skyr and berries.']), ['blender']);
  assert.deepEqual(detectEquipment(['Whip the cream with an electric mixer.']), ['mixer']);
  assert.deepEqual(detectEquipment(['Cook on the barbecue.']), ['grill']);
  assert.deepEqual(detectEquipment(['Cook in the pressure cooker.']), ['multicooker']);
});

test('a grill pan is a stove job', () => {
  assert.deepEqual(detectEquipment(['Cook the steak in a hot griddle pan.']), ['stove']);
});

test('no heat source means no cooking', () => {
  const eq = detectEquipment(['Mix the cottage cheese with berries.']);
  assert.deepEqual(eq, []);
  assert.equal(isNoCook(eq), true);
  assert.equal(isNoCook(['blender']), true);
  assert.equal(isNoCook(['oven']), false);
});
