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
    /** kcal per serving by meal (the ranges of the v1 recipes). */
    kcalRange: {
      breakfast: [500, 620],
      lunch: [560, 740],
      dinner: [465, 530],
      snack: [160, 215],
    } as Record<'breakfast' | 'lunch' | 'dinner' | 'snack', readonly [number, number]>,
    /** Protein: share of kcal (protein g × 4 / kcal) and grams per serving. */
    protein: {
      main: { minShare: 0.25, minGrams: 30 },
      snack: { minShare: 0.2, minGrams: 10 },
    },
  },
} as const;
