import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkTranslation,
  statedDurations,
  type Translation,
  type TranslationInput,
} from './check.ts';

const input: TranslationInput = {
  id: 'mdb_1',
  nameEn: 'Chicken Rice',
  category: 'Chicken',
  area: 'British',
  instructions: 'Fry the chicken for 5 minutes. Bake for 20 to 30 minutes. Rest 1 hour.',
  servings: 2,
  ingredients: [
    { id: 'chicken_breast', name: 'Chicken Breast', nameRu: 'Куриная грудка', measure: '400g' },
    { id: 'rice', name: 'Rice', nameRu: 'Рис', measure: '200g' },
  ],
};

const ok: Translation = {
  nameRu: 'Курица с рисом',
  descriptionRu: 'Простое блюдо.',
  descriptionEn: 'A simple dish.',
  steps: [
    {
      ru: 'Обжарьте курицу.',
      en: 'Fry the chicken.',
      timerSec: 300,
      ingredientRefs: ['chicken_breast'],
    },
    { ru: 'Запекайте.', en: 'Bake.', timerSec: 1800, ingredientRefs: [] },
  ],
  mealTypes: ['lunch'],
  isBatch: false,
  prepNightBefore: false,
};

test('statedDurations collects single values, both ends of ranges and hours', () => {
  assert.deepEqual(
    [...statedDurations(input.instructions)].sort((a, b) => a - b),
    [300, 1200, 1800, 3600],
  );
  assert.deepEqual([...statedDurations('Simmer 1.5 hrs or 45 secs')], [5400, 45]);
  assert.equal(statedDurations('Preheat oven to 375 F').size, 0);
});

test('a valid translation has no errors', () => {
  assert.deepEqual(checkTranslation(ok, input), []);
});

test('timers not stated in the source and unknown ingredient refs are errors', () => {
  const bad: Translation = {
    ...ok,
    steps: [{ ru: 'Варите.', en: 'Boil.', timerSec: 600, ingredientRefs: ['pasta'] }],
  };
  assert.deepEqual(checkTranslation(bad, input), [
    'step 1: unknown ingredient id "pasta"',
    'step 1: timer 600s is not a duration stated in the source',
  ]);
});

test('untranslated Russian fields and empty lists are errors', () => {
  const bad: Translation = { ...ok, nameRu: 'Chicken Rice', steps: [], mealTypes: [] };
  assert.deepEqual(checkTranslation(bad, input), [
    'nameRu is not Russian',
    'no steps',
    'mealTypes is empty',
  ]);
});
