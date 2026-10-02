import { existsSync } from 'node:fs';
import path from 'node:path';

import v1IdMap from '../../../../tools/data-pipeline/mappings/v1-id-map.json';
import catalogJson from '../../seed/catalog.v2.json';
import { SEED_INGREDIENTS } from '../../seed/ingredients';
import { SEED_LIDL } from '../../seed/lidl';
import { SEED_RECIPES } from '../../seed/recipes';
import type { Catalog } from '../schema';
import { validateCatalog, type ValidateOptions } from '../validate';

const IMAGES = path.join(__dirname, '..', '..', '..', '..', 'assets', 'images');
const imageExists = (key: string) =>
  ['webp', 'jpg'].some((ext) => existsSync(path.join(IMAGES, `${key}.${ext}`)));

const v1Ids = {
  ingredients: SEED_INGREDIENTS.map((i) => i.id),
  productVariants: SEED_LIDL.map((v) => v.id),
  recipes: SEED_RECIPES.map((r) => r.id),
};

describe('bundled catalog (src/db/seed/catalog.v2.json)', () => {
  it('passes validation', () => {
    const result = validateCatalog(catalogJson, {
      imageExists,
      v1Ids,
      v1IdMap,
      criteriaWarningsOnly: v1Ids.recipes,
    });
    expect(result.errors).toEqual([]);
  });
});

// ---------- the validator itself, on a tiny catalog ----------

const options: ValidateOptions = {
  imageExists: (key) => key === 'ok',
  v1Ids: { ingredients: ['chicken'], productVariants: [], recipes: [] },
  v1IdMap: { ingredients: {}, productVariants: {}, recipes: {} },
};

function tiny(): Catalog {
  return {
    catalogVersion: 1,
    ingredients: [
      {
        id: 'chicken',
        name: 'Курица',
        nameEn: 'Chicken',
        nameHu: null,
        synonyms: [],
        category: 'meat_poultry',
        subcategory: 'chicken',
        unit: 'g',
        gramsPerPiece: null,
        kcalPer100g: 110,
        proteinPer100g: 23,
        fatPer100g: 1.2,
        carbsPer100g: 0,
        isStaple: false,
        tags: [],
        source: 'usda',
        sourceId: '1',
        imageKey: 'ok',
      },
      {
        id: 'salt',
        name: 'Соль',
        nameEn: 'Salt',
        nameHu: null,
        synonyms: [],
        category: 'sauces_oils_spices',
        subcategory: 'spices',
        unit: 'g',
        gramsPerPiece: null,
        kcalPer100g: 0,
        proteinPer100g: 0,
        fatPer100g: null,
        carbsPer100g: null,
        isStaple: true,
        tags: ['vegan', 'vegetarian'],
        source: 'manual',
        sourceId: null,
        imageKey: null,
      },
    ],
    productVariants: [],
    recipes: [
      {
        id: 'r1',
        name: 'Курица',
        nameEn: 'Chicken',
        descriptionRu: null,
        descriptionEn: null,
        cuisine: null,
        mealType: 'lunch',
        mealTypes: ['lunch'],
        defaultServings: 1,
        isBatch: false,
        prepNightBefore: false,
        totalMinutes: 20,
        imageKey: null,
        tags: [],
        source: 'own',
        sourceId: null,
        sortOrder: 0,
        ingredientCount: 2,
        kcalPerServing: 605,
        proteinPerServing: 126.5,
        proteinDensity: 20.91,
      },
    ],
    recipeIngredients: [
      {
        recipeId: 'r1',
        ingredientId: 'chicken',
        amountPerServing: 550,
        unit: 'g',
        optional: false,
        altGroup: null,
        sortOrder: 0,
        note: null,
        noteEn: null,
      },
      {
        recipeId: 'r1',
        ingredientId: 'salt',
        amountPerServing: 0,
        unit: 'g',
        optional: false,
        altGroup: null,
        sortOrder: 1,
        note: 'по вкусу',
        noteEn: 'to taste',
      },
    ],
    recipeSteps: [
      {
        recipeId: 'r1',
        order: 1,
        text: 'Пожарьте.',
        textEn: 'Fry.',
        timerSec: 600,
        ingredientRefs: ['chicken'],
      },
    ],
  };
}

const errorsOf = (c: unknown, opts: ValidateOptions = options) => validateCatalog(c, opts).errors;

describe('validateCatalog', () => {
  it('accepts a consistent catalog', () => {
    expect(errorsOf(tiny())).toEqual([]);
  });

  it('reports schema problems with their path', () => {
    const c = tiny();
    (c.ingredients[0] as { kcalPer100g: number }).kcalPer100g = -1;
    expect(errorsOf(c)[0]).toMatch(/^schema: ingredients\.0\.kcalPer100g/);
  });

  it('finds duplicate ids, broken references and missing images', () => {
    const c = tiny();
    c.ingredients.push({ ...c.ingredients[0]!, name: 'Другая' });
    c.recipeSteps[0]!.ingredientRefs = ['ghost'];
    c.recipes[0]!.imageKey = 'missing';
    c.productVariants.push({
      id: 'v1',
      ingredientId: 'nope',
      title: 'X',
      brand: null,
      packageSize: 1,
      packageUnit: 'g',
      barcode: null,
      kcalPer100g: null,
      proteinPer100g: null,
      imageKey: null,
      source: 'own',
      sourceId: null,
    });
    expect(errorsOf(c)).toEqual(
      expect.arrayContaining([
        'duplicate ingredient id: chicken',
        'variant v1: unknown ingredient nope',
        'recipe r1 step 1: ghost is not an ingredient',
        'recipe r1: image missing does not exist',
      ]),
    );
  });

  it('finds duplicate names in one subcategory and impossible nutrition', () => {
    const c = tiny();
    c.ingredients.push({ ...c.ingredients[0]!, id: 'chicken2', proteinPer100g: 60 });
    expect(errorsOf(c)).toEqual(
      expect.arrayContaining([
        'duplicate name in meat_poultry/chicken/курица: chicken, chicken2',
        'ingredient chicken2: 60 g protein cannot fit in 110 kcal',
      ]),
    );
  });

  it('checks the precomputed values and the meal criteria', () => {
    const c = tiny();
    c.recipeIngredients[0]!.amountPerServing = 200; // 220 kcal: not a lunch any more
    expect(errorsOf(c)).toEqual(
      expect.arrayContaining([
        'recipe r1: kcalPerServing 605, lines give 220',
        'recipe r1 (lunch): 220 kcal outside 560–740',
      ]),
    );
  });

  it('turns the criteria into warnings for listed recipes', () => {
    const c = tiny();
    c.recipeIngredients[0]!.amountPerServing = 200;
    c.recipes[0]!.kcalPerServing = 220;
    c.recipes[0]!.proteinPerServing = 46;
    const result = validateCatalog(c, { ...options, criteriaWarningsOnly: ['r1'] });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(['recipe r1 (lunch): 220 kcal outside 560–740']);
  });

  it('only allows a zero amount for staples or optional lines', () => {
    const c = tiny();
    c.recipeIngredients[0]!.amountPerServing = 0;
    expect(errorsOf(c)).toContain('line r1/chicken: 0 is only allowed for staples');
  });

  it('requires every v1 id, following the id map', () => {
    const c = tiny();
    expect(errorsOf(c, { ...options, v1Ids: { ...options.v1Ids, recipes: ['Z1'] } })).toContain(
      'v1 recipes id Z1 is missing',
    );
    expect(
      errorsOf(c, {
        ...options,
        v1Ids: { ...options.v1Ids, recipes: ['Z1'] },
        v1IdMap: { ...options.v1IdMap, recipes: { Z1: 'r1' } },
      }),
    ).toEqual([]);
  });
});
