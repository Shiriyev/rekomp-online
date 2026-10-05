import { addDays, daysBetween } from './dates';
import type { MealType } from './types';

/** Portions the recipe card offers for any dish. */
export const SERVING_CHOICES = [1, 2, 3, 4, 5, 6] as const;

/** Lunch is cooked for three days; everything else for one meal. */
export function defaultServingsFor(mealType: MealType): number {
  return mealType === 'lunch' ? 3 : 1;
}

/** Days a cooked dish keeps when nothing better is known (portions cooked before v2.1). */
export const DEFAULT_STORAGE_DAYS = 3;

/** One portion now, the rest one per day: more than that would outlive the dish. */
export function exceedsStorage(servings: number, storageDays: number): boolean {
  return servings > storageDays + 1;
}

/** From this many portions the pot is big enough for a «bigger pan, a bit longer» hint. */
export const BIG_BATCH_SERVINGS = 3;

// Boiling, frying, stewing on the hob (not the oven: a bigger tray is not a problem).
const HEAT_WORDS =
  /(вар[иия]|свар|отвар|кипя|кипит|закип|жар[иь]|обжар|поджар|туш[иь]|пассер|бланшир|\bboil|simmer|\bfry|fried|fries|frying|saut[eé]|\bsear|\bstew|poach|braise)/i;

/** Whether a step cooks on the hob; with `heat` known (catalog v2.1) that decides. */
export function isHeatStep(step: { text: string; textEn?: string | null; heat?: string | null }) {
  if (step.heat !== undefined) return step.heat !== null;
  return HEAT_WORDS.test(step.text) || HEAT_WORDS.test(step.textEn ?? '');
}

export function needsBigPotHint(
  servings: number,
  step: { text: string; textEn?: string | null; heat?: string | null },
): boolean {
  return servings >= BIG_BATCH_SERVINGS && isHeatStep(step);
}

export type Freshness = {
  /** Last logical day the portion is good to eat (YYYY-MM-DD). */
  bestBefore: string;
  /** Days left including today; negative once expired. */
  daysLeft: number;
  expired: boolean;
};

/**
 * Freshness of a stored portion by logical days (the day starts at dayStartHour, 04:00 by
 * default): cooked on day D and keeping N days, it is good until D + N.
 */
export function portionFreshness(
  cookedOn: string,
  storageDays: number | null,
  today: string,
): Freshness {
  const bestBefore = addDays(cookedOn, storageDays ?? DEFAULT_STORAGE_DAYS);
  const daysLeft = daysBetween(today, bestBefore);
  return { bestBefore, daysLeft, expired: daysLeft < 0 };
}
