import { resolveLines, type AltChoices } from './nutrition';
import type { PantryStock, Shortage } from './pantry';
import { isStockTracked, type NutritionIngredient, type RecipeLine } from './types';
import { convertAmount, normalizeQuantity } from './units';

export type Consumption = {
  /** Amounts actually taken from the pantry (never more than what is there). */
  take: Shortage[];
  /** What the recipe needed on top of what was there. */
  shortfall: Shortage[];
};

/**
 * What cooking takes from the pantry: each tracked ingredient is reduced by the required
 * amount but never below zero; the missing part is recorded as shortfall.
 */
export function planConsumption(
  lines: readonly RecipeLine[],
  ingredients: ReadonlyMap<string, NutritionIngredient>,
  pantry: PantryStock,
  servings: number,
  choices: AltChoices,
): Consumption {
  const take: Shortage[] = [];
  const shortfall: Shortage[] = [];

  for (const line of resolveLines(lines, choices)) {
    const ingredient = ingredients.get(line.ingredientId);
    if (!ingredient) throw new Error(`Unknown ingredient "${line.ingredientId}"`);
    if (!isStockTracked(ingredient)) continue;

    const unit = ingredient.unit;
    const required = convertAmount(line.amountPerServing * servings, line.unit, unit, ingredient);
    if (required <= 0) continue;
    const stock = pantry.get(line.ingredientId);
    const available = stock ? convertAmount(stock.quantity, stock.unit, unit, ingredient) : 0;

    const taken = Math.min(required, available);
    if (taken > 0) take.push({ ingredientId: line.ingredientId, amount: taken, unit });
    const missing = required - taken;
    if (missing > 1e-6) shortfall.push({ ingredientId: line.ingredientId, amount: missing, unit });
  }
  return { take, shortfall };
}

/** New pantry quantity after taking an amount; clamped to zero and normalised. */
export function afterTaking(quantity: number, taken: number, unit: RecipeLine['unit']): number {
  return normalizeQuantity(quantity - taken, unit);
}

// ---------- Timers (wall-clock based, survive app restarts) ----------

export type TimerState = { durationSec: number; startedAt: number | null; elapsedSec: number };

export function elapsedSec(t: TimerState, now: number): number {
  return t.elapsedSec + (t.startedAt === null ? 0 : Math.max(0, now - t.startedAt) / 1000);
}

export function remainingSec(t: TimerState, now: number): number {
  return Math.max(0, t.durationSec - elapsedSec(t, now));
}

export const isRunning = (t: TimerState, now: number): boolean =>
  t.startedAt !== null && remainingSec(t, now) > 0;

export const isDone = (t: TimerState, now: number): boolean => remainingSec(t, now) <= 0;

/** Epoch ms when a running timer ends, or null when it is not running. */
export function endsAt(t: TimerState): number | null {
  return t.startedAt === null ? null : t.startedAt + (t.durationSec - t.elapsedSec) * 1000;
}

export function startTimer<T extends TimerState>(t: T, now: number): T {
  if (t.startedAt !== null || isDone(t, now)) return t;
  return { ...t, startedAt: now };
}

export function pauseTimer<T extends TimerState>(t: T, now: number): T {
  if (t.startedAt === null) return t;
  return { ...t, startedAt: null, elapsedSec: Math.min(t.durationSec, elapsedSec(t, now)) };
}

export function resetTimer<T extends TimerState>(t: T): T {
  return { ...t, startedAt: null, elapsedSec: 0 };
}

/** "9:00", "0:05", "1:02:03". */
export function formatTimer(seconds: number): string {
  const s = Math.ceil(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// ---------- Gamification ----------

const previousDay = (localDate: string): string => {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d - 1);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
};

/**
 * Days in a row with protein ≥ minimum. Today counts once reached; an unfinished
 * today does not break a streak that ran until yesterday.
 */
export function proteinStreak(
  proteinByDate: ReadonlyMap<string, number>,
  proteinMinG: number,
  today: string,
): number {
  const met = (d: string) => (proteinByDate.get(d) ?? 0) >= proteinMinG;
  let day = met(today) ? today : previousDay(today);
  let streak = 0;
  while (met(day)) {
    streak++;
    day = previousDay(day);
  }
  return streak;
}

export type StepIngredient = {
  ingredientId: string;
  /** In the ingredient's unit for the cooked servings; null for staples («по вкусу»). */
  amount: number | null;
  unit: RecipeLine['unit'];
};

/** Ingredients used on a step, limited to the chosen alternatives and scaled to servings. */
export function stepIngredients(
  refs: readonly string[],
  lines: readonly RecipeLine[],
  ingredients: ReadonlyMap<string, NutritionIngredient>,
  servings: number,
  choices: AltChoices,
): StepIngredient[] {
  const used = new Map(resolveLines(lines, choices).map((l) => [l.ingredientId, l]));
  return refs.flatMap((id) => {
    const line = used.get(id);
    const ingredient = ingredients.get(id);
    if (!line || !ingredient) return [];
    // Removed on the recipe card (amount 0): not part of this cook.
    if (!ingredient.isStaple && line.amountPerServing <= 0) return [];
    const amount = ingredient.isStaple
      ? null
      : convertAmount(line.amountPerServing * servings, line.unit, ingredient.unit, ingredient);
    return [{ ingredientId: id, amount, unit: ingredient.unit }];
  });
}

// ---------- One-page overview («Весь рецепт») ----------

type OverviewStep = { order: number; text: string; timerSec: number | null };

export type OverviewEntry = OverviewStep & {
  /** Where the step sits: the UI words it as «Сначала» / «Затем» / «В конце». */
  position: 'first' | 'middle' | 'last';
  /** Minute on the timeline when this step starts, counting timers only. */
  startsAtMin: number;
};

/** A timer length to show: seconds under a minute, else minutes with one decimal. */
export function durationParts(seconds: number): { unit: 'sec' | 'min'; value: number } {
  if (seconds < 60) return { unit: 'sec', value: Math.round(seconds) };
  return { unit: 'min', value: Math.round((seconds / 60) * 10) / 10 };
}

/**
 * The recipe as one readable sequence (first, then, …, at the end). Timings add up only
 * the timers (parallel steps make this an upper estimate).
 */
export function recipeOverview(steps: readonly OverviewStep[]): {
  entries: OverviewEntry[];
  timedTotalMin: number;
} {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  let elapsedSec = 0;
  const entries = sorted.map((step, i) => {
    const position: OverviewEntry['position'] =
      i === 0 ? 'first' : i === sorted.length - 1 ? 'last' : 'middle';
    const entry = { ...step, position, startsAtMin: Math.round(elapsedSec / 60) };
    elapsedSec += step.timerSec ?? 0;
    return entry;
  });
  return { entries, timedTotalMin: Math.round(elapsedSec / 60) };
}
