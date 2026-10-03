import { addDays, daysBetween } from '../dates';
import { customIngredientSchema, shoppingItemInputSchema } from '../schemas';
import { createSearchIndex, normalizeForSearch } from '../search';
import {
  defaultLowStockThreshold,
  isLowStock,
  purchaseAmount,
  shoppingStep,
  stepQuantity,
} from '../stock';

describe('low stock', () => {
  it('uses per-unit defaults', () => {
    expect(defaultLowStockThreshold('g')).toBe(100);
    expect(defaultLowStockThreshold('pcs')).toBe(2);
    expect(isLowStock(90, 'g', null)).toBe(true);
    expect(isLowStock(100, 'g', null)).toBe(false);
    expect(isLowStock(1, 'pcs', null)).toBe(true);
  });

  it('honours a custom threshold', () => {
    expect(isLowStock(300, 'g', 500)).toBe(true);
    expect(isLowStock(0, 'g', 0)).toBe(false);
  });
});

describe('purchaseAmount', () => {
  const egg = { id: 'egg', unit: 'pcs' as const, gramsPerPiece: 55 };
  const tvorog = { id: 'tvorog', unit: 'g' as const, gramsPerPiece: null };

  it('adds the wanted amount, converted to the product unit', () => {
    expect(purchaseAmount({ quantity: 150, unit: 'g' }, tvorog)).toBe(150);
    expect(purchaseAmount({ quantity: 110, unit: 'g' }, egg)).toBe(2);
  });

  it('adds one piece (or nothing by weight) without an amount', () => {
    expect(purchaseAmount({ quantity: null, unit: null }, egg)).toBe(1);
    expect(purchaseAmount({ quantity: null, unit: null }, tvorog)).toBe(0);
  });
});

describe('shoppingStep', () => {
  it('steps by 50 g / 50 ml / 1 шт', () => {
    expect([shoppingStep({ unit: 'g' }), shoppingStep({ unit: 'ml' })]).toEqual([50, 50]);
    expect(shoppingStep({ unit: 'pcs' })).toBe(1);
  });
});

describe('stepQuantity', () => {
  it.each([
    [500, 250, 1, 750],
    [500, 250, -1, 250],
    [250, 250, -1, 250],
    [900, 2000, 1, 2000],
    [900, 2000, -1, 2000],
    [2900, 2000, -1, 2000],
    [15, 1000, 1, 1000],
    [3, 1, 1, 4],
    [3, 1, -1, 2],
  ] as const)('%p step %p dir %p → %p', (current, step, dir, expected) => {
    expect(stepQuantity(current, step, dir)).toBe(expected);
  });
});

const searchIngredients = (
  items: readonly { name: string; nameHu: string | null; aliases?: string[] }[],
  q: string,
) => createSearchIndex(items, (i) => [i.name, i.nameHu, ...(i.aliases ?? [])]).search(q).items;

describe('search', () => {
  const items = [
    { name: 'Творог', nameHu: 'túró' },
    { name: 'Греческий йогурт', nameHu: 'görög joghurt' },
    { name: 'Йогурт 0,1%', nameHu: 'zsírszegény joghurt' },
    { name: 'Зелёная чечевица (сухая)', nameHu: 'zöld lencse' },
    { name: 'Яйцо', nameHu: null },
  ];

  it('normalises case, accents and ё', () => {
    expect(normalizeForSearch('  Túró ')).toBe('turo');
    expect(normalizeForSearch('Зелёная')).toBe('зеленая');
  });

  it('matches Russian and Hungarian names, prefix matches first', () => {
    expect(searchIngredients(items, 'turo').map((i) => i.name)).toEqual(['Творог']);
    expect(searchIngredients(items, 'йог').map((i) => i.name)).toEqual([
      'Греческий йогурт',
      'Йогурт 0,1%',
    ]);
    expect(searchIngredients(items, 'зелен').map((i) => i.name)).toEqual([
      'Зелёная чечевица (сухая)',
    ]);
    expect(searchIngredients(items, 'ghurt').map((i) => i.name)).toEqual([
      'Греческий йогурт',
      'Йогурт 0,1%',
    ]);
  });

  it('returns everything for an empty query and nothing for no match', () => {
    expect(searchIngredients(items, ' ')).toHaveLength(5);
    expect(searchIngredients(items, 'xyz')).toEqual([]);
  });
});

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-09-27', 7)).toBe('2026-10-04');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-09-25', '2026-09-27')).toBe(2);
    expect(daysBetween('2026-09-27', '2026-09-27')).toBe(0);
    // Across the DST change (25 Oct 2026).
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('schemas', () => {
  it('requires grams per piece for piece-based custom ingredients', () => {
    const base = {
      name: 'Протеиновый батончик',
      category: 'dairy_eggs' as const,
      kcalPer100g: 350,
      proteinPer100g: 30,
    };
    expect(
      customIngredientSchema.safeParse({ ...base, unit: 'pcs', gramsPerPiece: null }).success,
    ).toBe(false);
    expect(
      customIngredientSchema.safeParse({ ...base, unit: 'pcs', gramsPerPiece: 60 }).success,
    ).toBe(true);
    expect(
      customIngredientSchema.safeParse({ ...base, unit: 'g', gramsPerPiece: null }).success,
    ).toBe(true);
  });

  it('requires quantity and unit together on shopping items', () => {
    const base = { title: 'Бумажные полотенца', ingredientId: null };
    expect(shoppingItemInputSchema.safeParse({ ...base, quantity: null, unit: null }).success).toBe(
      true,
    );
    expect(shoppingItemInputSchema.safeParse({ ...base, quantity: 2, unit: null }).success).toBe(
      false,
    );
  });
});

describe('searchIngredients aliases', () => {
  it('matches other-language names', () => {
    const items = [{ name: 'Творог', nameHu: 'túró', aliases: ['Cottage cheese'] }];
    expect(searchIngredients(items, 'cott')).toHaveLength(1);
    expect(searchIngredients(items, 'cheese')).toHaveLength(1);
  });
});
