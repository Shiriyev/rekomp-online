import { addDays, daysBetween, parseDayMonth } from '../dates';
import { customIngredientSchema, lidlProductSchema, shoppingItemInputSchema } from '../schemas';
import { normalizeForSearch, searchIngredients } from '../search';
import { defaultLowStockThreshold, isLowStock, purchaseAmount } from '../stock';

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

  it('rounds up to whole packages', () => {
    expect(
      purchaseAmount({ quantity: 300, unit: 'g' }, tvorog, { packageSize: 250, packageUnit: 'g' }),
    ).toBe(500);
    expect(
      purchaseAmount({ quantity: 250, unit: 'g' }, tvorog, { packageSize: 250, packageUnit: 'g' }),
    ).toBe(250);
    expect(
      purchaseAmount({ quantity: 2, unit: 'pcs' }, egg, { packageSize: 10, packageUnit: 'pcs' }),
    ).toBe(10);
  });

  it('buys one package when no amount was given', () => {
    expect(
      purchaseAmount({ quantity: null, unit: null }, tvorog, {
        packageSize: 250,
        packageUnit: 'g',
      }),
    ).toBe(250);
  });

  it('converts package units to the ingredient unit', () => {
    // A 330 g pack of eggs = 6 pieces.
    expect(
      purchaseAmount({ quantity: 3, unit: 'pcs' }, egg, { packageSize: 330, packageUnit: 'g' }),
    ).toBe(6);
  });

  it('falls back to the wanted amount without a package', () => {
    expect(purchaseAmount({ quantity: 150, unit: 'g' }, tvorog, undefined)).toBe(150);
    expect(purchaseAmount({ quantity: null, unit: null }, egg, undefined)).toBe(1);
    expect(purchaseAmount({ quantity: null, unit: null }, tvorog, undefined)).toBe(0);
    expect(
      purchaseAmount({ quantity: 150, unit: 'g' }, tvorog, { packageSize: 0, packageUnit: 'g' }),
    ).toBe(150);
  });
});

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

  it.each([
    ['05.10', '2026-10-05'],
    ['5/10', '2026-10-05'],
    ['27.09', '2026-09-27'],
    ['20.09', '2027-09-20'],
    ['01.03.2027', '2027-03-01'],
  ])('parses %p relative to 2026-09-27', (input, expected) => {
    expect(parseDayMonth(input, '2026-09-27')).toBe(expected);
  });

  it('handles 29.02 only when next February has it', () => {
    expect(parseDayMonth('29.02', '2026-09-27')).toBeNull();
    expect(parseDayMonth('29.02', '2027-09-27')).toBe('2028-02-29');
  });

  it.each(['', '31.02.2026', '32.01', '12', 'abc', '1.13'])('rejects %p', (input) => {
    expect(parseDayMonth(input, '2026-09-27')).toBeNull();
  });
});

describe('schemas', () => {
  it('requires grams per piece for piece-based custom ingredients', () => {
    const base = {
      name: 'Протеиновый батончик',
      category: 'dairy' as const,
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

  it('drops the sale date when the product is not on sale and validates barcodes', () => {
    const base = {
      ingredientId: 'tvorog',
      title: 'Túró 250 g',
      packageSize: 250,
      packageUnit: 'g' as const,
      priceHuf: 549,
      saleUntil: '2026-10-01',
      barcode: null,
      notes: null,
    };
    expect(lidlProductSchema.parse({ ...base, onSale: false }).saleUntil).toBeNull();
    expect(lidlProductSchema.parse({ ...base, onSale: true }).saleUntil).toBe('2026-10-01');
    expect(lidlProductSchema.safeParse({ ...base, onSale: false, barcode: '12ab' }).success).toBe(
      false,
    );
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
