import { format } from 'date-fns';

/** Local calendar day (device time zone) used to group logs, e.g. "2026-09-27". */
export function toLocalDate(timestampMs: number): string {
  return format(new Date(timestampMs), 'yyyy-MM-dd');
}
