import { eq } from 'drizzle-orm';

import { DEFAULT_DAY_START_HOUR, deviceTimeZone, getLogicalDate } from '../domain/day';
import { appMeta, mealLogs, profile } from './schema';
import type { AppDb } from './types';

/** The user's day start hour (default before onboarding). */
export function dayStartHourOf(db: AppDb): number {
  const row = db
    .select({ hour: profile.dayStartHour })
    .from(profile)
    .where(eq(profile.id, 1))
    .get();
  return row?.hour ?? DEFAULT_DAY_START_HOUR;
}

/** Logical day of a timestamp under the stored rule; call inside the writing transaction. */
export function logicalDateAt(db: AppDb, timestamp: number): string {
  return getLogicalDate(timestamp, dayStartHourOf(db), deviceTimeZone());
}

/**
 * Re-derives `meal_logs.local_date` from `timestamp` under the given rule and returns how
 * many rows moved. Deterministic, so running it twice changes nothing the second time.
 * Does not open a transaction: callers wrap it together with whatever changed the rule.
 */
export function recomputeLocalDates(
  db: AppDb,
  dayStartHour: number,
  timeZone: string = deviceTimeZone(),
): number {
  const rows = db
    .select({ id: mealLogs.id, timestamp: mealLogs.timestamp, localDate: mealLogs.localDate })
    .from(mealLogs)
    .all();
  let changed = 0;
  for (const row of rows) {
    const localDate = getLogicalDate(row.timestamp, dayStartHour, timeZone);
    if (localDate === row.localDate) continue;
    db.update(mealLogs).set({ localDate }).where(eq(mealLogs.id, row.id)).run();
    changed++;
  }
  return changed;
}

/** app_meta marker: v1 logs (calendar midnight) were moved to the logical-day rule. */
export const LOGICAL_DAY_MIGRATION_KEY = 'logical_day_migrated';

/**
 * One-time data migration after the SQL migrations. Guarded by a marker rather than run on
 * every start, so a later time-zone change (travel) never silently re-files old entries.
 * Idempotent either way. Returns the number of moved rows, or null when already applied.
 */
export function runDataMigrations(db: AppDb): number | null {
  return db.transaction((tx) => {
    const done = tx.select().from(appMeta).where(eq(appMeta.key, LOGICAL_DAY_MIGRATION_KEY)).get();
    if (done) return null;
    const moved = recomputeLocalDates(tx, dayStartHourOf(tx));
    tx.insert(appMeta).values({ key: LOGICAL_DAY_MIGRATION_KEY, value: '1' }).run();
    return moved;
  });
}
