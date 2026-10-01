import { afterAdding, bulkStep, defaultAddAmount, smallestPackages } from '../bulkAdd';

const tvorog = { id: 'tvorog', unit: 'g' as const, gramsPerPiece: null };
const egg = { id: 'egg', unit: 'pcs' as const, gramsPerPiece: 55 };

describe('defaultAddAmount', () => {
  it('uses the Lidl package size first', () => {
    expect(defaultAddAmount(tvorog, { packageSize: 250, packageUnit: 'g' }, 500)).toBe(250);
    // A pack of 10 eggs in pieces; a 550 g pack converted to pieces.
    expect(defaultAddAmount(egg, { packageSize: 10, packageUnit: 'pcs' }, null)).toBe(10);
    expect(defaultAddAmount(egg, { packageSize: 550, packageUnit: 'g' }, null)).toBe(10);
  });

  it('falls back to the last added amount, then 100 g / 1 шт', () => {
    expect(defaultAddAmount(tvorog, undefined, 400)).toBe(400);
    expect(defaultAddAmount(tvorog, { packageSize: 0, packageUnit: 'g' }, null)).toBe(100);
    expect(defaultAddAmount(tvorog, undefined, 0)).toBe(100);
    expect(defaultAddAmount(egg, undefined, null)).toBe(1);
  });
});

describe('afterAdding / bulkStep', () => {
  it('sums with what is at home', () => {
    expect(afterAdding(200, 250, 'g')).toBe(450);
    expect(afterAdding(null, 2.5, 'pcs')).toBe(2.5);
    expect(afterAdding(3, -1, 'pcs')).toBe(3);
  });

  it('steps 10 g / 10 ml / 1 шт', () => {
    expect([bulkStep('g'), bulkStep('ml'), bulkStep('pcs')]).toEqual([10, 10, 1]);
  });
});

describe('smallestPackages', () => {
  it('keeps the smallest package per ingredient', () => {
    const map = smallestPackages([
      { ingredientId: 'a', packageSize: 500, packageUnit: 'g' as const },
      { ingredientId: 'a', packageSize: 250, packageUnit: 'g' as const },
      { ingredientId: 'a', packageSize: 1000, packageUnit: 'g' as const },
      { ingredientId: 'b', packageSize: 1, packageUnit: 'pcs' as const },
    ]);
    expect(map.get('a')?.packageSize).toBe(250);
    expect(map.get('b')?.packageSize).toBe(1);
  });
});
