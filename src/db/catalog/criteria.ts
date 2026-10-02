import type { MealType } from '../../domain/types';

/**
 * Recomp criteria every catalog recipe meets (PHASE_2 task 3). Shared by the data pipeline
 * (filter) and the catalog validator, so the two can never disagree.
 */
export const RECIPE_CRITERIA = {
  /** kcal per serving by meal (the ranges of the v1 recipes). */
  kcalRange: {
    breakfast: [500, 620],
    lunch: [560, 740],
    dinner: [465, 530],
    snack: [160, 215],
  } satisfies Record<MealType, readonly [number, number]>,
  /** Protein: share of kcal (protein g × 4 / kcal) and grams per serving. */
  protein: {
    main: { minShare: 0.25, minGrams: 30 },
    snack: { minShare: 0.2, minGrams: 10 },
  },
} as const;

export const proteinCriteria = (meal: MealType) =>
  meal === 'snack' ? RECIPE_CRITERIA.protein.snack : RECIPE_CRITERIA.protein.main;
