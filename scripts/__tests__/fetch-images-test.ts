/**
 * @jest-environment node
 */
import { SEED_INGREDIENTS } from '../../src/db/seed/ingredients';
import { SEED_RECIPES } from '../../src/db/seed/recipes';
import { IMAGE_QUERIES, renderAttribution, renderRegistry } from '../fetch-images';

describe('image queries', () => {
  it('cover every recipe and every non-staple ingredient exactly once', () => {
    const recipes = IMAGE_QUERIES.filter((q) => q.kind === 'recipes').map((q) => q.key);
    const ingredients = IMAGE_QUERIES.filter((q) => q.kind === 'ingredients').map((q) => q.key);
    expect(recipes.sort()).toEqual(SEED_RECIPES.map((r) => r.id.toLowerCase()).sort());
    expect(ingredients.sort()).toEqual(
      SEED_INGREDIENTS.filter((i) => !i.isStaple)
        .map((i) => i.id)
        .sort(),
    );
  });
});

describe('generated files', () => {
  it('renders a registry with requires only for present files', () => {
    const src = renderRegistry([
      { kind: 'recipes', key: 'z1' },
      { kind: 'ingredients', key: 'egg' },
    ]);
    expect(src).toContain("z1: require('../../assets/images/recipes/z1.jpg'),");
    expect(src).toContain("egg: require('../../assets/images/ingredients/egg.jpg'),");
    expect(src).not.toContain('z2');
  });

  it('credits photographers in ATTRIBUTION.md', () => {
    const md = renderAttribution([
      {
        kind: 'recipes',
        key: 'u4',
        photographer: 'Ann',
        photographerUrl: 'https://pexels.com/@ann',
        pageUrl: 'https://pexels.com/photo/1',
      },
    ]);
    expect(md).toContain(
      '| recipes/u4.jpg | [Ann](https://pexels.com/@ann) | [Pexels](https://pexels.com/photo/1) |',
    );
  });
});
