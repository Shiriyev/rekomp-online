/**
 * Every tunable of the pipeline in one place (PHASE_2: «вынести в конфиг, не хардкодить»).
 * Sources, politeness limits, and later the recomposition criteria.
 */
import { RECIPE_CRITERIA } from './src/lib/app.ts';
/** Bump when the catalog content changes; the app updates its catalog when this grows. */
export const CATALOG_VERSION = 12;

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

  http: { retries: 5, backoffMs: 1_000, timeoutMs: 60_000 },

  images: {
    /** WebP quality and long side in px: about the size cards are drawn at on a phone. */
    quality: 70,
    recipeSide: 560,
    productSide: 320,
    /** Pexels allows ~200 requests/hour. */
    pexelsPauseMs: 2_000,
  },

  /** Default fridge life in days (FIXES_v2.1 task 2); reviewed values win. */
  storage: {
    long: 3,
    short: 1,
    shortWords: /\b(salad|slaw|omelet+e?|frittata|scrambled|eggs?|toast|sandwich|wrap|smoothie)\b/i,
  },

  /**
   * Pruning (FIXES_v2.1 task 3). Words are regex sources matched at a word start, so a
   * stem catches its forms («грил» → гриль, гриле; «grill» → grilled). «Kebab» alone is
   * not a grill (doner in a pan); skewered kebabs are caught by «skewer» / «шампур».
   */
  prune: {
    minRecipeUses: 3,
    /** Recount until stable: leaves only own dishes with this catalog (146 → 20). */
    cascade: false,
    grillWords: [
      'grill',
      'griddle',
      'barbecue',
      'bbq',
      'broil',
      'skewer',
      'char-?grill',
      'грил',
      'мангал',
      'шашлык',
      'шампур',
    ],
    notAdaptableWords: ['barbecue', 'bbq', 'skewer', 'charcoal', 'мангал', 'шашлык', 'шампур'],
    /** A product, not a cooking method. */
    grillIgnore: ['(barbecue|bbq) (sauce|pork)', 'соус барбекю', 'свинин\\S* барбекю'],
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
