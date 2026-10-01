/** @jest-environment node */
import { SEED_INGREDIENTS } from '../../db/seed/ingredients';
import { SEED_RECIPES } from '../../db/seed/recipes';
import { INGREDIENTS_EN, RECIPES_EN, TAGS_EN } from '../content/en';

const CYRILLIC = /[Ѐ-ӿ]/;

describe('English built-in content', () => {
  it.each(SEED_RECIPES.map((r) => [r.id, r] as const))(
    'recipe %s has a name and every step',
    (id, recipe) => {
      const en = RECIPES_EN[id]!;
      expect(en).toBeDefined();
      expect(en.name.trim()).not.toBe('');
      expect(en.steps).toHaveLength(recipe.steps.length);
      en.steps.forEach((step) => expect(step.trim()).not.toBe(''));
    },
  );

  it.each(SEED_RECIPES.map((r) => [r.id, r] as const))(
    'recipe %s has notes exactly for its noted lines',
    (id, recipe) => {
      const noted = recipe.lines.filter((l) => l.note !== undefined).map((l) => l.id);
      const notes = RECIPES_EN[id]?.notes ?? {};
      for (const ingredientId of noted) {
        expect(notes[ingredientId]?.trim()).toBeTruthy();
      }
      const lineIds = new Set(recipe.lines.map((l) => l.id));
      for (const ingredientId of Object.keys(notes)) {
        expect(lineIds.has(ingredientId)).toBe(true);
      }
    },
  );

  it('has no recipes beyond the seed', () => {
    const seedIds = new Set(SEED_RECIPES.map((r) => r.id));
    expect(Object.keys(RECIPES_EN).filter((id) => !seedIds.has(id))).toEqual([]);
  });

  it('names every seed ingredient', () => {
    const missing = SEED_INGREDIENTS.filter((i) => !INGREDIENTS_EN[i.id]?.trim()).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it('translates every seed tag', () => {
    const tags = new Set(SEED_RECIPES.flatMap((r) => r.tags ?? []));
    expect([...tags].filter((t) => !TAGS_EN[t]?.trim())).toEqual([]);
  });

  it('contains no Cyrillic', () => {
    const strings = [
      ...Object.values(RECIPES_EN).flatMap((r) => [
        r.name,
        ...r.steps,
        ...Object.values(r.notes ?? {}),
      ]),
      ...Object.values(INGREDIENTS_EN),
      ...Object.values(TAGS_EN),
    ];
    expect(strings.filter((s) => CYRILLIC.test(s))).toEqual([]);
  });
});
