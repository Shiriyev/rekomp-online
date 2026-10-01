import { addDays } from './dates';

/**
 * The «logical day»: food eaten after midnight but before `dayStartHour` belongs to the
 * previous day (a late snack at 00:30 on 1 Oct counts for 30 Sep).
 */
export const DEFAULT_DAY_START_HOUR = 4;
export const MIN_DAY_START_HOUR = 0;
export const MAX_DAY_START_HOUR = 6;

export function isValidDayStartHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= MIN_DAY_START_HOUR && hour <= MAX_DAY_START_HOUR;
}

/** IANA time zone of the device, e.g. "Europe/Budapest". */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

type WallClock = { year: number; month: number; day: number; hour: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClockIn(timestamp: number, timeZone: string): WallClock {
  // Fast path: the device zone is what Date's local getters already use.
  if (timeZone === deviceTimeZone()) {
    const d = new Date(timestamp);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours() };
  }
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Some engines print midnight as "24" even with h23.
    hour: Number(parts.hour) % 24,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The single source of truth for which day an entry belongs to ('YYYY-MM-DD').
 * Wall-clock based, so DST switches never move an entry: 03:59 is always «yesterday»
 * and 04:00 always «today» when the day starts at 04:00.
 */
export function getLogicalDate(timestamp: number, dayStartHour: number, timeZone: string): string {
  if (!Number.isFinite(timestamp)) throw new RangeError(`Invalid timestamp ${timestamp}`);
  if (!isValidDayStartHour(dayStartHour)) {
    throw new RangeError(`dayStartHour must be an integer 0–6, got ${dayStartHour}`);
  }
  const { year, month, day, hour } = wallClockIn(timestamp, timeZone);
  const calendarDate = `${year}-${pad(month)}-${pad(day)}`;
  return hour < dayStartHour ? addDays(calendarDate, -1) : calendarDate;
}

/**
 * Milliseconds until the next logical day starts (device time zone), so a screen left
 * open overnight can switch to the new day exactly at e.g. 04:00.
 */
export function msUntilNextDayStart(now: number, dayStartHour: number): number {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayStartHour);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now;
}
