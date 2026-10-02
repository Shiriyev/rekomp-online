/**
 * Every tunable of the pipeline in one place (PHASE_2: «вынести в конфиг, не хардкодить»).
 * Sources, politeness limits, and later the recomposition criteria.
 */
import { RECIPE_CRITERIA } from './src/lib/app.ts';
/** Bump when the catalog content changes; the app updates its catalog when this grows. */
export const CATALOG_VERSION = 3;

export const config = {
  userAgent: `Rekomp-data-pipeline/0.1 (${process.env.PIPELINE_CONTACT ?? '<PIPELINE_CONTACT>'})`,

  mealdb: {
    base: 'https://www.themealdb.com/api/json/v1/1',
    letters: 'abcdefghijklmnopqrstuvwxyz'.split(''),
    pauseMs: 400,
  },

  usda: {
    /** The downloads page is read at run time; links are never guessed. */
    downloadsPage: 'https://fdc.nal.usda.gov/download-datasets/',
    origin: 'https://fdc.nal.usda.gov',
    /** Latest CSV zip whose file name matches each pattern. */
    datasets: {
      foundation: /FoodData_Central_foundation_food_csv_[\d-]+\.zip/,
      srLegacy: /FoodData_Central_sr_legacy_food_csv_[\d-]+\.zip/,
    },
  },

  off: {
    base: 'https://world.openfoodfacts.org/api/v2/search',
    stores: 'lidl',
    country: 'en:hungary',
    pageSize: 100,
    /** Search API limit is 10 req/min/IP; stay well below it. */
    pauseMs: 7_000,
    fields: [
      'code',
      'product_name',
      'product_name_hu',
      'product_name_en',
      'brands',
      'quantity',
      'product_quantity',
      'product_quantity_unit',
      'categories_tags',
      'nutriments',
      'image_front_url',
      'stores_tags',
      'countries_tags',
    ],
  },

  http: { retries: 5, backoffMs: 1_000, timeoutMs: 60_000 },

  images: {
    /** WebP quality and long side in px (PHASE_2 task 5). */
    quality: 75,
    recipeSide: 800,
    productSide: 400,
    /** Pexels allows ~200 requests/hour. */
    pexelsPauseMs: 2_000,
  },

  /** Recipe acceptance (PHASE_2 task 3). */
  filter: {
    excludedCategories: ['Dessert'] as readonly string[],
    maxIngredients: 15,
    /** Only applied when the instructions state durations we can add up. */
    maxMinutes: 90,
    /** An alcohol ingredient above this share of the dish weight makes it alcohol-based. */
    maxAlcoholShare: 0.1,
    /** Servings tried when sizing a portion. */
    servings: { min: 1, max: 6 },
    /** kcal ranges and protein minimums, shared with the app's catalog validator. */
    kcalRange: RECIPE_CRITERIA.kcalRange,
    protein: RECIPE_CRITERIA.protein,
  },
} as const;
