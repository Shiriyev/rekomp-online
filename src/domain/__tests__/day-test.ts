import {
  DEFAULT_DAY_START_HOUR,
  deviceTimeZone,
  getLogicalDate,
  isValidDayStartHour,
  msUntilNextDayStart,
} from '../day';

const TZ = 'Europe/Budapest';
const HOUR = 3_600_000;

/** Wall-clock time in the test zone (the test script runs with TZ=Europe/Budapest). */
const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

describe('getLogicalDate', () => {
  it('runs in the Europe/Budapest time zone (set by the test script)', () => {
    expect(deviceTimeZone()).toBe(TZ);
    expect(DEFAULT_DAY_START_HOUR).toBe(4);
  });

  it('keeps the evening in the same day', () => {
    expect(getLogicalDate(local(2026, 9, 30, 23, 59), 4, TZ)).toBe('2026-09-30');
  });

  it('puts the hours after midnight into the previous day', () => {
    expect(getLogicalDate(local(2026, 10, 1, 0, 0), 4, TZ)).toBe('2026-09-30');
    expect(getLogicalDate(local(2026, 10, 1, 0, 30), 4, TZ)).toBe('2026-09-30');
    expect(getLogicalDate(local(2026, 10, 1, 3, 59), 4, TZ)).toBe('2026-09-30');
  });

  it('starts the new day at 04:00', () => {
    expect(getLogicalDate(local(2026, 10, 1, 4, 0), 4, TZ)).toBe('2026-10-01');
  });

  it('crosses month and year boundaries', () => {
    expect(getLogicalDate(local(2027, 1, 1, 1, 0), 4, TZ)).toBe('2026-12-31');
    expect(getLogicalDate(local(2026, 3, 1, 2, 0), 4, TZ)).toBe('2026-02-28');
  });

  it('handles the spring DST switch (last Sunday of March, 02:00 → 03:00)', () => {
    // 29 Mar 2026: 01:59 UTC = 03:59 CEST, 02:00 UTC = 04:00 CEST.
    expect(getLogicalDate(Date.UTC(2026, 2, 29, 0, 30), 4, TZ)).toBe('2026-03-28'); // 01:30 CET
    expect(getLogicalDate(Date.UTC(2026, 2, 29, 1, 30), 4, TZ)).toBe('2026-03-28'); // 03:30 CEST
    expect(getLogicalDate(Date.UTC(2026, 2, 29, 1, 59), 4, TZ)).toBe('2026-03-28');
    expect(getLogicalDate(Date.UTC(2026, 2, 29, 2, 0), 4, TZ)).toBe('2026-03-29');
  });

  it('handles the autumn DST switch (last Sunday of October, 03:00 → 02:00)', () => {
    // 25 Oct 2026: 02:00–03:00 happens twice; both belong to 24 Oct.
    expect(getLogicalDate(Date.UTC(2026, 9, 25, 0, 30), 4, TZ)).toBe('2026-10-24'); // 02:30 CEST
    expect(getLogicalDate(Date.UTC(2026, 9, 25, 1, 30), 4, TZ)).toBe('2026-10-24'); // 02:30 CET
    expect(getLogicalDate(Date.UTC(2026, 9, 25, 2, 59), 4, TZ)).toBe('2026-10-24'); // 03:59 CET
    expect(getLogicalDate(Date.UTC(2026, 9, 25, 3, 0), 4, TZ)).toBe('2026-10-25'); // 04:00 CET
  });

  it('works as the plain calendar day when the day starts at 00:00', () => {
    // 22:30 UTC on 27 Sep is 00:30 on 28 Sep in Budapest (CEST, UTC+2).
    expect(getLogicalDate(Date.UTC(2026, 8, 27, 22, 30), 0, TZ)).toBe('2026-09-28');
    expect(getLogicalDate(Date.UTC(2026, 8, 27, 21, 59), 0, TZ)).toBe('2026-09-27');
    // Winter time (CET, UTC+1).
    expect(getLogicalDate(Date.UTC(2026, 0, 15, 23, 30), 0, TZ)).toBe('2026-01-16');
    expect(getLogicalDate(Date.UTC(2026, 0, 15, 22, 59), 0, TZ)).toBe('2026-01-15');
  });

  it('supports other start hours', () => {
    expect(getLogicalDate(local(2026, 10, 1, 5, 59), 6, TZ)).toBe('2026-09-30');
    expect(getLogicalDate(local(2026, 10, 1, 6, 0), 6, TZ)).toBe('2026-10-01');
  });

  it('uses the given zone even when it is not the device zone', () => {
    const t = Date.UTC(2026, 9, 1, 2, 30); // 02:30 UTC, 11:30 Tokyo, 22:30 New York (30 Sep)
    expect(getLogicalDate(t, 4, 'UTC')).toBe('2026-09-30');
    expect(getLogicalDate(t, 0, 'UTC')).toBe('2026-10-01');
    expect(getLogicalDate(t, 4, 'Asia/Tokyo')).toBe('2026-10-01');
    expect(getLogicalDate(t, 4, 'America/New_York')).toBe('2026-09-30');
    // Cached formatter on the second call.
    expect(getLogicalDate(Date.UTC(2026, 9, 1, 4, 0), 4, 'UTC')).toBe('2026-10-01');
  });

  it('rejects invalid input', () => {
    expect(() => getLogicalDate(Number.NaN, 4, TZ)).toThrow(RangeError);
    expect(() => getLogicalDate(0, 7, TZ)).toThrow(RangeError);
    expect(() => getLogicalDate(0, -1, TZ)).toThrow(RangeError);
    expect(() => getLogicalDate(0, 1.5, TZ)).toThrow(RangeError);
  });
});

describe('isValidDayStartHour', () => {
  it('accepts whole hours 0–6', () => {
    expect([0, 1, 4, 6].every(isValidDayStartHour)).toBe(true);
    expect([-1, 7, 2.5, Number.NaN].some(isValidDayStartHour)).toBe(false);
  });
});

describe('msUntilNextDayStart', () => {
  it('counts to the boundary later the same night', () => {
    expect(msUntilNextDayStart(local(2026, 10, 1, 3, 0), 4)).toBe(HOUR);
    expect(msUntilNextDayStart(local(2026, 9, 30, 23, 0), 4)).toBe(5 * HOUR);
  });

  it('counts to tomorrow once the boundary has passed', () => {
    expect(msUntilNextDayStart(local(2026, 10, 1, 4, 0), 4)).toBe(24 * HOUR);
    expect(msUntilNextDayStart(local(2026, 10, 1, 12, 0), 0)).toBe(12 * HOUR);
  });

  it('measures real time across DST switches', () => {
    expect(msUntilNextDayStart(local(2026, 3, 29, 0, 0), 4)).toBe(3 * HOUR);
    expect(msUntilNextDayStart(local(2026, 10, 25, 0, 0), 4)).toBe(5 * HOUR);
  });
});
