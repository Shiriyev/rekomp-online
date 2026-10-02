import { normalizeForSearch, similarity, suggestSimilar } from '../search';

describe('normalizeForSearch cache', () => {
  it('stays correct after the cache is cleared', () => {
    for (let i = 0; i < 5001; i++) normalizeForSearch(`Продукт ${i}`);
    expect(normalizeForSearch('Túró Ёжик')).toBe('turo ежик');
    expect(normalizeForSearch('Túró Ёжик')).toBe('turo ежик'); // from the cache
  });
});

describe('suggestSimilar', () => {
  const items = [
    { name: 'Брокколи', nameHu: 'brokkoli', aliases: ['Broccoli'] },
    { name: 'Куриная грудка', nameHu: null, aliases: ['Chicken breast'] },
    { name: 'Творог', nameHu: 'túró' },
    { name: 'Сыр', nameHu: null },
  ];

  it('finds products despite typos, in any language and by word', () => {
    expect(suggestSimilar(items, 'брокали').map((i) => i.name)).toEqual(['Брокколи']);
    expect(suggestSimilar(items, 'brocoli').map((i) => i.name)).toEqual(['Брокколи']);
    expect(suggestSimilar(items, 'грудки').map((i) => i.name)).toEqual(['Куриная грудка']);
    expect(suggestSimilar(items, 'turo').map((i) => i.name)).toEqual(['Творог']);
    // Sharing a few letters is not enough («brokoli» vs «broad beans», «brown rice»).
    const beans = [{ name: 'Бобы', nameHu: null, aliases: ['Broad beans'] }, ...items];
    expect(suggestSimilar(beans, 'brokoli').map((i) => i.name)).toEqual(['Брокколи']);
  });

  it('offers nothing for very short or unrelated queries', () => {
    expect(suggestSimilar(items, 'б')).toEqual([]);
    expect(suggestSimilar(items, 'шоколад')).toEqual([]);
  });

  it('ranks by similarity and respects the limit', () => {
    const many = [{ name: 'Сыры' }, { name: 'Сыр' }, { name: 'Сырок' }].map((x) => ({
      ...x,
      nameHu: null,
    }));
    expect(suggestSimilar(many, 'сыр', 2).map((i) => i.name)).toEqual(['Сыр', 'Сыры']);
    const tie = [{ name: 'Сыр твёрдый' }, { name: 'Сыр мягкий' }].map((x) => ({
      ...x,
      nameHu: null,
    }));
    expect(suggestSimilar(tie, 'сыр').map((i) => i.name)).toEqual(['Сыр мягкий', 'Сыр твёрдый']);
  });
});

describe('similarity', () => {
  it('is 1 for equal and 0 for disjoint strings', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('ab', 'xy')).toBe(0);
  });
});
