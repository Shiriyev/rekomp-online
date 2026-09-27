import {
  convertAmount,
  normalizeQuantity,
  quantityStep,
  toGrams,
  UnitConversionError,
} from '../units';

const egg = { id: 'egg', gramsPerPiece: 55 };
const tvorog = { id: 'tvorog', gramsPerPiece: null };

describe('toGrams', () => {
  it('passes grams and millilitres through (density 1)', () => {
    expect(toGrams(250, 'g', tvorog)).toBe(250);
    expect(toGrams(120, 'ml', tvorog)).toBe(120);
  });

  it('converts pieces with gramsPerPiece, including halves', () => {
    expect(toGrams(3, 'pcs', egg)).toBe(165);
    expect(toGrams(0.5, 'pcs', { id: 'onion', gramsPerPiece: 100 })).toBe(50);
  });

  it('rejects pieces without gramsPerPiece', () => {
    expect(() => toGrams(1, 'pcs', tvorog)).toThrow(UnitConversionError);
    expect(() => toGrams(1, 'pcs', { id: 'x', gramsPerPiece: 0 })).toThrow(UnitConversionError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid amount %p', (amount) => {
    expect(() => toGrams(amount, 'g', tvorog)).toThrow(UnitConversionError);
  });
});

describe('convertAmount', () => {
  it('is identity for the same unit', () => {
    expect(convertAmount(7, 'pcs', 'pcs', tvorog)).toBe(7);
  });

  it('converts pieces <-> grams', () => {
    expect(convertAmount(2, 'pcs', 'g', egg)).toBe(110);
    expect(convertAmount(110, 'g', 'pcs', egg)).toBe(2);
    expect(convertAmount(100, 'ml', 'g', tvorog)).toBe(100);
  });

  it('fails converting to pieces without gramsPerPiece', () => {
    expect(() => convertAmount(100, 'g', 'pcs', tvorog)).toThrow(UnitConversionError);
  });
});

describe('quantityStep / normalizeQuantity', () => {
  it('uses 50 for weight/volume and 1 for pieces', () => {
    expect(quantityStep('g')).toBe(50);
    expect(quantityStep('ml')).toBe(50);
    expect(quantityStep('pcs')).toBe(1);
  });

  it('rounds g/ml to integers, pieces to halves, clamps at zero', () => {
    expect(normalizeQuantity(349.6, 'g')).toBe(350);
    expect(normalizeQuantity(6.74, 'pcs')).toBe(6.5);
    expect(normalizeQuantity(6.76, 'pcs')).toBe(7);
    expect(normalizeQuantity(-20, 'g')).toBe(0);
  });
});
