import { addDays } from './dates';
import { deviceTimeZone, getLogicalDate } from './day';

/** «7:05», «07:05», «7.05» → { hour, minute }; null when not a valid time. */
export function parseTimeOfDay(input: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(input.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Calendar date and «HH:MM» of a timestamp in the device zone, for the edit form. */
export function splitTimestamp(timestamp: number): { date: string; time: string } {
  const d = new Date(timestamp);
  // Day start 0 = the plain calendar day.
  return {
    date: getLogicalDate(timestamp, 0, deviceTimeZone()),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Device-local wall-clock time → epoch ms (a time skipped by DST moves forward). */
export function joinDateTime(date: string, hour: number, minute: number): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, minute).getTime();
}

/** Previous/next calendar day for the date stepper. */
export const shiftDate = (date: string, days: number): string => addDays(date, days);

/** Entries cannot be moved into the future (a minute of slack for clock drift). */
export const MAX_FUTURE_MS = 60_000;

export function isAllowedEntryTime(timestamp: number, now: number): boolean {
  return Number.isFinite(timestamp) && timestamp <= now + MAX_FUTURE_MS;
}
