/**
 * Every tunable of the pipeline in one place (PHASE_2: «вынести в конфиг, не хардкодить»).
 * Sources, politeness limits, and later the recomposition criteria.
 */
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
} as const;
