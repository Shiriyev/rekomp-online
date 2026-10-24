import type { MealType } from '../../domain/types';

/**
 * Recomp criteria every catalog recipe meets (PHASE_2 task 3). Shared by the data pipeline
 * (filter) and the catalog validator, so the two can never disagree.
 */
export const RECIPE_CRITERIA = {
  /**
   * kcal per serving by meal. These started as the narrow ranges of the v1 recipes, which
   * rejected 151 dishes for fitting no serving size at all. Widened to a band a portion can
   * plausibly land in: the dish still has to clear the protein bar, and the card shows the
   * kcal so the choice stays the cook's.
   */
  kcalRange: {
    breakfast: [350, 800],
    lunch: [400, 950],
    dinner: [350, 800],
    snack: [100, 350],
  } satisfies Record<MealType, readonly [number, number]>,
  /** Protein: share of kcal (protein g × 4 / kcal) and grams per serving. */
  protein: {
    main: { minShare: 0.25, minGrams: 30 },
    snack: { minShare: 0.2, minGrams: 10 },
  },
} as const;

export const proteinCriteria = (meal: MealType) =>
  meal === 'snack' ? RECIPE_CRITERIA.protein.snack : RECIPE_CRITERIA.protein.main;
