import { autoChoices, canCook, type PantryStock } from '../pantry';
import type { NutritionIngredient, RecipeLine, Unit } from '../types';

const ing = (
  id: string,
  unit: Unit = 'g',
  extra: Partial<NutritionIngredient> = {},
): NutritionIngredient => ({
  id,
  unit,
  gramsPerPiece: unit === 'pcs' ? 55 : null,
  kcalPer100g: 100,
  proteinPer100g: 10,
  isStaple: false,
  ...extra,
});

const INGREDIENTS = new Map(
  [
    ing('tvorog'),
    ing('skyr'),
    ing('greek'),
    ing('egg', 'pcs'),
    ing('onion', 'pcs', { gramsPerPiece: 100 }),
    ing('salt', 'g', { isStaple: true }),
  ].map((i) => [i.id, i]),
);

let order = 0;
const line = (
  ingredientId: string,
  amountPerServing: number,
  extra: Partial<RecipeLine> = {},
): RecipeLine => ({
  ingredientId,
  amountPerServing,
  unit: INGREDIENTS.get(ingredientId)!.unit,
  optional: false,
  altGroup: null,
  sortOrder: order++,
  ...extra,
});

const pantry = (entries: Record<string, number>): PantryStock =>
  new Map(
    Object.entries(entries).map(([id, q]) => [
      id,
      { quantity: q, unit: INGREDIENTS.get(id)!.unit },
    ]),
  );

// tvorog 150 g + egg 2 pcs + (skyr | greek) 150 g + salt
const RECIPE = [
  line('tvorog', 150),
  line('egg', 2),
  line('skyr', 150, { altGroup: 'y' }),
  line('greek', 150, { altGroup: 'y' }),
  line('salt', 0),
];

describe('canCook', () => {
  it('is ok when everything is at home', () => {
    const r = canCook(RECIPE, INGREDIENTS, pantry({ tvorog: 500, egg: 6, skyr: 150 }), 1);
    expect(r.status).toBe('ok');
    expect(r.missing).toEqual([]);
    expect(r.lines.map((l) => l.status)).toEqual(['ok', 'ok', 'ok']);
  });

  it('is partial with low and missing lines and reports the shortfall', () => {
    const r = canCook(RECIPE, INGREDIENTS, pantry({ tvorog: 100, skyr: 150 }), 1);
    expect(r.status).toBe('partial');
    expect(r.lines.find((l) => l.line.ingredientId === 'tvorog')?.status).toBe('low');
    expect(r.missing).toEqual([
      { ingredientId: 'tvorog', amount: 50, unit: 'g' },
      { ingredientId: 'egg', amount: 2, unit: 'pcs' },
    ]);
  });

  it('is none when no tracked ingredient is at home', () => {
    const r = canCook(RECIPE, INGREDIENTS, pantry({}), 1);
    expect(r.status).toBe('none');
    expect(r.missing).toHaveLength(3);
  });

  it('scales requirements with servings', () => {
    const stock = pantry({ tvorog: 300, egg: 4, skyr: 300 });
    expect(canCook(RECIPE, INGREDIENTS, stock, 2).status).toBe('ok');
    const three = canCook(RECIPE, INGREDIENTS, stock, 3);
    expect(three.status).toBe('partial');
    expect(three.missing).toEqual([
      { ingredientId: 'tvorog', amount: 150, unit: 'g' },
      { ingredientId: 'egg', amount: 2, unit: 'pcs' },
      { ingredientId: 'skyr', amount: 150, unit: 'g' },
    ]);
  });

  it('accepts any member of an alternative group', () => {
    const r = canCook(RECIPE, INGREDIENTS, pantry({ tvorog: 150, egg: 2, greek: 200 }), 1);
    expect(r.status).toBe('ok');
    expect(r.choices).toEqual({ y: 'greek' });
    const yogurt = r.lines.find((l) => l.line.altGroup === 'y');
    expect(yogurt?.line.ingredientId).toBe('greek');
    expect(yogurt?.alternatives).toEqual(['skyr']);
  });

  it('honours an explicit alternative choice even if it is missing', () => {
    const r = canCook(RECIPE, INGREDIENTS, pantry({ tvorog: 150, egg: 2, greek: 200 }), 1, {
      y: 'skyr',
    });
    expect(r.status).toBe('partial');
    expect(r.missing).toEqual([{ ingredientId: 'skyr', amount: 150, unit: 'g' }]);
  });

  it('ignores staples entirely', () => {
    const r = canCook(
      [line('salt', 5), line('tvorog', 100)],
      INGREDIENTS,
      pantry({ tvorog: 100 }),
      1,
    );
    expect(r.status).toBe('ok');
    expect(r.lines.map((l) => l.line.ingredientId)).toEqual(['tvorog']);
  });

  it('skips optional lines', () => {
    const r = canCook(
      [line('tvorog', 100), line('egg', 1, { optional: true })],
      INGREDIENTS,
      pantry({ tvorog: 100 }),
      1,
    );
    expect(r.status).toBe('ok');
  });

  it('converts units between the recipe line and the pantry', () => {
    // Recipe asks for grams of a piece-based ingredient: 150 g onion = 1.5 pcs.
    const r = canCook([line('onion', 150, { unit: 'g' })], INGREDIENTS, pantry({ onion: 1 }), 1);
    expect(r.lines[0]).toMatchObject({ required: 1.5, available: 1, unit: 'pcs', status: 'low' });
  });

  it('tolerates float noise at the boundary', () => {
    const r = canCook(
      [line('onion', 0.1), line('egg', 0.3)],
      INGREDIENTS,
      pantry({ onion: 0.1, egg: 0.1 + 0.2 }),
      1,
    );
    expect(r.status).toBe('ok');
  });

  it('rejects invalid servings and unknown ingredients', () => {
    expect(() => canCook(RECIPE, INGREDIENTS, pantry({}), 0)).toThrow(RangeError);
    expect(() =>
      canCook(
        [line('tvorog', 1), { ...line('tvorog', 1), ingredientId: 'ghost' }],
        INGREDIENTS,
        pantry({}),
        1,
      ),
    ).toThrow('Unknown ingredient');
  });
});

describe('autoChoices', () => {
  it('prefers the default when there is enough of it', () => {
    expect(autoChoices(RECIPE, INGREDIENTS, pantry({ skyr: 150, greek: 150 }), 1)).toEqual({
      y: 'skyr',
    });
  });

  it('falls back to the best partial coverage, then to the default', () => {
    expect(autoChoices(RECIPE, INGREDIENTS, pantry({ skyr: 50, greek: 100 }), 1)).toEqual({
      y: 'greek',
    });
    expect(autoChoices(RECIPE, INGREDIENTS, pantry({}), 1)).toEqual({ y: 'skyr' });
  });

  it('treats a zero requirement as covered', () => {
    const lines = [line('skyr', 0, { altGroup: 'z' }), line('greek', 0, { altGroup: 'z' })];
    expect(autoChoices(lines, INGREDIENTS, pantry({}), 1)).toEqual({ z: 'skyr' });
  });
});
