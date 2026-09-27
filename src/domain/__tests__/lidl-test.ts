import { isSaleActive } from '../lidl';

describe('isSaleActive', () => {
  const today = '2026-09-27';

  it('is false when not on sale', () => {
    expect(isSaleActive({ onSale: false, saleUntil: '2026-12-31' }, today)).toBe(false);
  });

  it('is true until and including the last day', () => {
    expect(isSaleActive({ onSale: true, saleUntil: '2026-09-27' }, today)).toBe(true);
    expect(isSaleActive({ onSale: true, saleUntil: '2026-10-01' }, today)).toBe(true);
  });

  it('expires automatically after the last day', () => {
    expect(isSaleActive({ onSale: true, saleUntil: '2026-09-26' }, today)).toBe(false);
  });

  it('is open-ended without a date', () => {
    expect(isSaleActive({ onSale: true, saleUntil: null }, today)).toBe(true);
  });
});
