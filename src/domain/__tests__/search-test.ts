import { createSearchIndex, normalizeForSearch, similarity, suggestSimilar } from '../search';

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

describe('createSearchIndex', () => {
  const items = [
    { id: 'tvorog', names: ['Творог', 'túró', 'Cottage cheese'] },
    { id: 'chicken', names: ['Куриная грудка', 'csirkemell', 'Chicken breast', 'курица'] },
    { id: 'yogurt', names: ['Греческий йогурт', null, 'Greek yogurt'] },
    { id: 'broccoli', names: ['Брокколи', 'brokkoli', undefined] },
  ];
  const index = createSearchIndex(items, (i) => i.names);
  const ids = (q: string, fuzzy = false) => {
    const r = index.search(q, { fuzzy });
    return { ids: r.items.map((i) => i.id), similar: r.similar };
  };

  it('returns the whole list for an empty query', () => {
    expect(ids('  ')).toEqual({ ids: ['tvorog', 'chicken', 'yogurt', 'broccoli'], similar: false });
  });

  it('matches any name without case or accents, word starts before inner matches', () => {
    expect(ids('TURO').ids).toEqual(['tvorog']);
    expect(ids('курица').ids).toEqual(['chicken']);
    expect(ids('yog').ids).toEqual(['yogurt']);
    // «ch» starts «Chicken» and is inside «Cottage cheese»… which also starts a word.
    expect(ids('ch').ids).toEqual(['tvorog', 'chicken']);
    expect(ids('руд').ids).toEqual(['chicken']);
  });

  it('offers look-alikes only when asked and nothing matches', () => {
    expect(ids('брокали')).toEqual({ ids: [], similar: false });
    expect(ids('брокали', true)).toEqual({ ids: ['broccoli'], similar: true });
    expect(ids('zzzz', true)).toEqual({ ids: [], similar: true });
    expect(ids('ъ', true)).toEqual({ ids: [], similar: false });
    expect(ids('твор', true)).toEqual({ ids: ['tvorog'], similar: false });
  });
});

describe('createSearchIndex look-alikes', () => {
  it('ranks look-alikes by similarity, ties in list order', () => {
    const index = createSearchIndex(
      [{ n: 'Капуста' }, { n: 'Броколи' }, { n: 'Брокколи замороженная' }, { n: 'Брокколи' }],
      (i) => [i.n],
    );
    const r = index.search('брокколли', { fuzzy: true });
    expect(r.similar).toBe(true);
    // A word of a longer name counts like the whole name: equal scores keep the list order.
    expect(r.items.map((i) => i.n)).toEqual(['Брокколи замороженная', 'Брокколи', 'Броколи']);
  });
});
