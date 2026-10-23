import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildRules, SUBSTITUTION_RULES } from '../substitutionRules';

describe('buildRules', () => {
  it('makes every pair in a group swappable both ways', () => {
    const rules = buildRules([{ name: 'g', members: ['a', 'b', 'c'] }]);
    expect(rules.get('a')!.map((s) => s.id)).toEqual(['b', 'c']);
    expect(rules.get('b')!.map((s) => s.id)).toEqual(['a', 'c']);
    expect(rules.get('c')!.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('never offers a product as its own stand-in', () => {
    const rules = buildRules([{ name: 'g', members: ['a', 'b'] }]);
    for (const [id, subs] of rules) expect(subs.map((s) => s.id)).not.toContain(id);
  });

  it('inverts the ratio in the opposite direction', () => {
    const rules = buildRules([{ name: 'g', members: ['fresh', ['dried', 4]] }]);
    // 4 g of fresh is replaced by 1 g of dried, and the other way round.
    expect(rules.get('fresh')!).toEqual([{ id: 'dried', ratio: 0.25 }]);
    expect(rules.get('dried')!).toEqual([{ id: 'fresh', ratio: 4 }]);
  });

  it('merges a product that appears in several groups', () => {
    const rules = buildRules([
      { name: 'one', members: ['shared', 'a'] },
      { name: 'two', members: ['shared', 'b'] },
    ]);
    expect(rules.get('shared')!.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('keeps the ratio of the first group to name a pair', () => {
    const rules = buildRules([
      { name: 'one', members: ['x', ['y', 2]] },
      { name: 'two', members: ['x', ['y', 10]] },
    ]);
    expect(rules.get('x')!).toEqual([{ id: 'y', ratio: 0.5 }]);
  });

  it('leaves a lone member with no stand-ins', () => {
    const rules = buildRules([{ name: 'g', members: ['only'] }]);
    expect(rules.get('only')).toEqual([]);
  });
});

describe('SUBSTITUTION_RULES', () => {
  const catalog = JSON.parse(
    readFileSync(path.join(__dirname, '../../db/seed/catalog.v2.json'), 'utf8'),
  ) as { ingredients: { id: string }[] };
  const known = new Set(catalog.ingredients.map((i) => i.id));

  it('only names products that are in the catalog', () => {
    const unknown = new Set<string>();
    for (const [id, subs] of SUBSTITUTION_RULES) {
      if (!known.has(id)) unknown.add(id);
      for (const s of subs) if (!known.has(s.id)) unknown.add(s.id);
    }
    expect([...unknown]).toEqual([]);
  });

  it('gives every swap a positive, finite ratio', () => {
    for (const [, subs] of SUBSTITUTION_RULES) {
      for (const s of subs) {
        expect(Number.isFinite(s.ratio)).toBe(true);
        expect(s.ratio).toBeGreaterThan(0);
      }
    }
  });

  it('lists no product twice for the same original', () => {
    for (const [, subs] of SUBSTITUTION_RULES) {
      const ids = subs.map((s) => s.id);
      expect(ids).toHaveLength(new Set(ids).size);
    }
  });

  it('covers the swaps the app was asked for', () => {
    const subs = (id: string) => (SUBSTITUTION_RULES.get(id) ?? []).map((s) => s.id);
    expect(subs('olive_oil')).toContain('oil');
    expect(subs('olive_oil')).toContain('butter');
    expect(subs('beef_mince')).toContain('turkey_mince');
    expect(subs('turkey_mince')).toContain('beef_mince');
  });
});
