import { recipeMacros, resolveLines } from '../nutrition';
import { autoChoices, canCook, type PantryStock } from '../pantry';
import {
  AUTO_GROUP_PREFIX,
  expandSubstitutions,
  isAutoGroup,
  type SubstitutionRules,
} from '../substitutions';
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
    ing('olive_oil', 'g', { kcalPer100g: 884, proteinPer100g: 0 }),
    ing('oil', 'g', { kcalPer100g: 884, proteinPer100g: 0 }),
    ing('butter', 'g', { kcalPer100g: 717, proteinPer100g: 0.9 }),
    ing('beef_mince', 'g', { kcalPer100g: 190, proteinPer100g: 18.2 }),
    ing('turkey_mince', 'g', { kcalPer100g: 140, proteinPer100g: 19 }),
    ing('tofu'),
    ing('egg', 'pcs'),
    ing('onion'),
  ].map((i) => [i.id, i]),
);

const line = (
  ingredientId: string,
  amountPerServing: number,
  sortOrder: number,
  extra: Partial<RecipeLine> = {},
): RecipeLine => ({
  ingredientId,
  amountPerServing,
  unit: INGREDIENTS.get(ingredientId)?.unit ?? 'g',
  optional: false,
  altGroup: null,
  sortOrder,
  ...extra,
});

const rules = (entries: Record<string, { id: string; ratio: number }[]>): SubstitutionRules =>
  new Map(Object.entries(entries));

const OIL_RULES = rules({
  olive_oil: [
    { id: 'oil', ratio: 1 },
    { id: 'butter', ratio: 1.1 },
  ],
});

const expand = (lines: readonly RecipeLine[], r: SubstitutionRules = OIL_RULES) =>
  expandSubstitutions(lines, r, INGREDIENTS);

describe('isAutoGroup', () => {
  it('recognises only groups generated from the global rules', () => {
    expect(isAutoGroup(`${AUTO_GROUP_PREFIX}olive_oil`)).toBe(true);
    expect(isAutoGroup('yogurt')).toBe(false);
    expect(isAutoGroup(null)).toBe(false);
  });
});

describe('expandSubstitutions', () => {
  it('adds a line per stand-in and keeps the original as the default', () => {
    const out = expand([line('olive_oil', 10, 0), line('onion', 50, 1)]);

    expect(out.map((l) => l.ingredientId)).toEqual(['olive_oil', 'oil', 'butter', 'onion']);
    const group = `${AUTO_GROUP_PREFIX}olive_oil`;
    expect(out.slice(0, 3).map((l) => l.altGroup)).toEqual([group, group, group]);
    expect(out[3]!.altGroup).toBeNull();

    // The original keeps the lowest sortOrder in its group, and the next line still follows.
    const orders = out.map((l) => l.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(orders[0]).toBe(0);
    expect(orders[3]).toBe(1);
    expect(resolveLines(out)).toHaveLength(2);
    expect(resolveLines(out)[0]!.ingredientId).toBe('olive_oil');
  });

  it('scales a stand-in by its ratio', () => {
    const out = expand([line('olive_oil', 10, 0)]);
    expect(out[1]).toMatchObject({ ingredientId: 'oil', amountPerServing: 10 });
    expect(out[2]).toMatchObject({ ingredientId: 'butter', amountPerServing: 11 });
  });

  it('converts a stand-in into its own unit', () => {
    const out = expand([line('tofu', 110, 0)], rules({ tofu: [{ id: 'egg', ratio: 1 }] }));
    expect(out[1]).toMatchObject({ ingredientId: 'egg', unit: 'pcs', amountPerServing: 2 });
  });

  it('measures the original in grams before scaling', () => {
    const out = expand([line('egg', 2, 0)], rules({ egg: [{ id: 'tofu', ratio: 0.5 }] }));
    expect(out[1]).toMatchObject({ ingredientId: 'tofu', unit: 'g', amountPerServing: 55 });
  });

  it('leaves a line the catalog already grouped', () => {
    const lines = [line('olive_oil', 10, 0, { altGroup: 'fat' })];
    expect(expand(lines)).toEqual(lines);
  });

  it('leaves an optional line', () => {
    const lines = [line('olive_oil', 10, 0, { optional: true })];
    expect(expand(lines)).toEqual(lines);
  });

  it('leaves a line whose product is not in the catalog', () => {
    const lines = [line('ghee', 10, 0)];
    expect(expand(lines, rules({ ghee: [{ id: 'butter', ratio: 1 }] }))).toEqual(lines);
  });

  it('leaves a line no rule covers', () => {
    const lines = [line('onion', 50, 0)];
    expect(expand(lines)).toEqual(lines);
  });

  it('skips a stand-in that is not in the catalog', () => {
    const out = expand(
      [line('olive_oil', 10, 0)],
      rules({
        olive_oil: [
          { id: 'rapeseed_oil', ratio: 1 },
          { id: 'butter', ratio: 1 },
        ],
      }),
    );
    expect(out.map((l) => l.ingredientId)).toEqual(['olive_oil', 'butter']);
  });

  it('skips a stand-in the recipe already lists, which would double-count it', () => {
    const out = expand([line('olive_oil', 10, 0), line('butter', 20, 1)]);
    expect(out.map((l) => l.ingredientId)).toEqual(['olive_oil', 'oil', 'butter']);
    expect(out.filter((l) => l.ingredientId === 'butter')).toHaveLength(1);
  });

  it('leaves the line untouched when every stand-in is unusable', () => {
    const lines = [line('olive_oil', 10, 0), line('oil', 5, 1), line('butter', 20, 2)];
    expect(expand(lines)).toEqual(lines);
  });

  it('keeps an empty rule list from grouping the line', () => {
    const lines = [line('olive_oil', 10, 0)];
    expect(expand(lines, rules({ olive_oil: [] }))).toEqual(lines);
  });
});

describe('expandSubstitutions feeding the existing engine', () => {
  const MINCE_RULES = rules({ beef_mince: [{ id: 'turkey_mince', ratio: 1 }] });
  const LINES = [line('beef_mince', 100, 0)];
  const pantry = (entries: Record<string, number>): PantryStock =>
    new Map(Object.entries(entries).map(([id, quantity]) => [id, { quantity, unit: 'g' as Unit }]));

  it('offers the stand-in as an alternative on the line', () => {
    const out = expandSubstitutions(LINES, MINCE_RULES, INGREDIENTS);
    const check = canCook(out, INGREDIENTS, pantry({ beef_mince: 500 }), 1);
    expect(check.status).toBe('ok');
    expect(check.lines[0]!.alternatives).toEqual(['turkey_mince']);
  });

  it('picks the stand-in when only it is at home', () => {
    const out = expandSubstitutions(LINES, MINCE_RULES, INGREDIENTS);
    const choices = autoChoices(out, INGREDIENTS, pantry({ turkey_mince: 500 }), 1);
    expect(choices[`${AUTO_GROUP_PREFIX}beef_mince`]).toBe('turkey_mince');
    expect(canCook(out, INGREDIENTS, pantry({ turkey_mince: 500 }), 1).status).toBe('ok');
  });

  it('still prefers the original when both are at home', () => {
    const out = expandSubstitutions(LINES, MINCE_RULES, INGREDIENTS);
    const choices = autoChoices(
      out,
      INGREDIENTS,
      pantry({ beef_mince: 500, turkey_mince: 500 }),
      1,
    );
    expect(choices[`${AUTO_GROUP_PREFIX}beef_mince`]).toBe('beef_mince');
  });

  it('recalculates nutrition for the chosen stand-in', () => {
    const out = expandSubstitutions(LINES, MINCE_RULES, INGREDIENTS);
    expect(recipeMacros(out, INGREDIENTS).perServing).toEqual({ kcal: 190, protein: 18.2 });
    const swapped = recipeMacros(out, INGREDIENTS, {
      choices: { [`${AUTO_GROUP_PREFIX}beef_mince`]: 'turkey_mince' },
    });
    expect(swapped.perServing).toEqual({ kcal: 140, protein: 19 });
  });
});
