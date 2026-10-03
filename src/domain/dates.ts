// Calendar arithmetic on YYYY-MM-DD strings. Which day a timestamp belongs to is decided
// only by getLogicalDate (domain/day.ts).

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
