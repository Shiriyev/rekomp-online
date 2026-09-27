import { format } from 'date-fns';

/** Local calendar day (device time zone) used to group logs, e.g. "2026-09-27". */
export function toLocalDate(timestampMs: number): string {
  return format(new Date(timestampMs), 'yyyy-MM-dd');
}

const pad = (n: number) => String(n).padStart(2, '0');
const fromParts = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (localDate: string) => {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/** Local date n days after (or before) the given one. */
export function addDays(localDate: string, n: number): string {
  const d = toDate(localDate);
  d.setDate(d.getDate() + n);
  return fromParts(d);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/**
 * Parses «05.10» or «05.10.2026» into YYYY-MM-DD. Without a year, picks the next
 * occurrence on or after today (a sale end is never in the past). Returns null if invalid.
 */
export function parseDayMonth(input: string, today: string): string | null {
  const m = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?$/.exec(input.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const todayYear = Number(today.slice(0, 4));
  const build = (year: number) => {
    const d = new Date(year, month - 1, day);
    return d.getMonth() === month - 1 && d.getDate() === day ? fromParts(d) : null;
  };
  if (m[3]) return build(Number(m[3]));
  const thisYear = build(todayYear);
  if (thisYear === null) return build(todayYear + 1);
  return thisYear >= today ? thisYear : build(todayYear + 1);
}
