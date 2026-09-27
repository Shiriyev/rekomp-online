import { toLocalDate } from '../dates';

describe('toLocalDate', () => {
  it('runs in the Europe/Budapest time zone (set by the test script)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Budapest');
  });

  it('groups by the local day, not the UTC day', () => {
    // 22:30 UTC on 27 Sep is 00:30 on 28 Sep in Budapest (CEST, UTC+2).
    expect(toLocalDate(Date.UTC(2026, 8, 27, 22, 30))).toBe('2026-09-28');
    expect(toLocalDate(Date.UTC(2026, 8, 27, 21, 59))).toBe('2026-09-27');
  });

  it('handles winter time (CET, UTC+1)', () => {
    expect(toLocalDate(Date.UTC(2026, 0, 15, 23, 30))).toBe('2026-01-16');
    expect(toLocalDate(Date.UTC(2026, 0, 15, 22, 59))).toBe('2026-01-15');
  });
});
