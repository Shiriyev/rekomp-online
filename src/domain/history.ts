import { addDays } from './dates';
import type { Macros } from './types';

export type DayVerdict = { kcal: 'ok' | 'over' | 'under'; protein: 'ok' | 'low' };

/** Allowed drift around the kcal target before a day counts as over/under. */
export const KCAL_OVER_RATIO = 1.05;
export const KCAL_UNDER_RATIO = 0.85;

export function dayVerdict(
  totals: Macros,
  targets: { kcalTarget: number; proteinMinG: number },
): DayVerdict {
  const kcal =
    totals.kcal > targets.kcalTarget * KCAL_OVER_RATIO
      ? 'over'
      : totals.kcal < targets.kcalTarget * KCAL_UNDER_RATIO
        ? 'under'
        : 'ok';
  return { kcal, protein: totals.protein >= targets.proteinMinG ? 'ok' : 'low' };
}

export type DayPoint = Macros & { date: string; logged: boolean };

/** One point per day for the `days` days ending at `endDate`, oldest first; gaps are zero. */
export function dailySeries(
  byDate: ReadonlyMap<string, Macros>,
  endDate: string,
  days: number,
): DayPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(endDate, i - days + 1);
    const m = byDate.get(date);
    return { date, kcal: m?.kcal ?? 0, protein: m?.protein ?? 0, logged: m !== undefined };
  });
}

/**
 * Average over days that have entries; `excludeDate` (usually today, still in progress)
 * is left out so a half-finished day does not drag the average down.
 */
export function averageOfLogged(
  series: readonly DayPoint[],
  excludeDate?: string,
): (Macros & { days: number }) | null {
  const used = series.filter((p) => p.logged && p.date !== excludeDate);
  if (used.length === 0) return null;
  const sum = used.reduce(
    (acc, p) => ({ kcal: acc.kcal + p.kcal, protein: acc.protein + p.protein }),
    {
      kcal: 0,
      protein: 0,
    },
  );
  return { kcal: sum.kcal / used.length, protein: sum.protein / used.length, days: used.length };
}
