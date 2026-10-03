import { afterAdding, bulkStep, defaultAddAmount } from '../bulkAdd';

const tvorog = { unit: 'g' as const };
const egg = { unit: 'pcs' as const };

describe('defaultAddAmount', () => {
  it('uses the last added amount, then 100 g / 1 шт', () => {
    expect(defaultAddAmount(tvorog, 400)).toBe(400);
    expect(defaultAddAmount(tvorog, null)).toBe(100);
    expect(defaultAddAmount(tvorog, 0)).toBe(100);
    expect(defaultAddAmount(egg, null)).toBe(1);
    expect(defaultAddAmount(egg, 6)).toBe(6);
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
