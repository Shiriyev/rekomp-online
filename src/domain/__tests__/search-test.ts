import { normalizeForSearch } from '../search';

describe('normalizeForSearch cache', () => {
  it('stays correct after the cache is cleared', () => {
    for (let i = 0; i < 5001; i++) normalizeForSearch(`Продукт ${i}`);
    expect(normalizeForSearch('Túró Ёжик')).toBe('turo ежик');
    expect(normalizeForSearch('Túró Ёжик')).toBe('turo ежик'); // from the cache
  });
});
