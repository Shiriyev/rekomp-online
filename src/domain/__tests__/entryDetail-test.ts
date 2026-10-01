import {
  entryPhoto,
  isAllowedEntryTime,
  joinDateTime,
  parseTimeOfDay,
  shiftDate,
  splitTimestamp,
} from '../entryDetail';

describe('entryPhoto', () => {
  const has = (key: string) => key === 'z1';

  it('prefers the own photo, then the recipe picture, then a placeholder', () => {
    expect(entryPhoto({ photoUri: 'file:///a.jpg' }, 'z1', has)).toEqual({
      kind: 'own',
      uri: 'file:///a.jpg',
    });
    expect(entryPhoto({ photoUri: null }, 'z1', has)).toEqual({ kind: 'recipe', imageKey: 'z1' });
    expect(entryPhoto({ photoUri: null }, 'zz', has)).toEqual({ kind: 'none' });
    expect(entryPhoto({ photoUri: null }, null, has)).toEqual({ kind: 'none' });
  });
});

describe('parseTimeOfDay', () => {
  it('accepts common spellings', () => {
    expect(parseTimeOfDay('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTimeOfDay(' 00.30 ')).toEqual({ hour: 0, minute: 30 });
    expect(parseTimeOfDay('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('rejects invalid times', () => {
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('12:60')).toBeNull();
    expect(parseTimeOfDay('1230')).toBeNull();
    expect(parseTimeOfDay('')).toBeNull();
  });
});

describe('splitTimestamp / joinDateTime', () => {
  it('round-trips a device-local time (Europe/Budapest in tests)', () => {
    const t = new Date(2026, 9, 1, 0, 30).getTime();
    expect(splitTimestamp(t)).toEqual({ date: '2026-10-01', time: '00:30' });
    expect(joinDateTime('2026-10-01', 0, 30)).toBe(t);
  });

  it('moves a time skipped by DST forward', () => {
    // 29 Mar 2026 02:30 does not exist in Budapest; JS lands on 03:30 CEST.
    expect(splitTimestamp(joinDateTime('2026-03-29', 2, 30)).time).toBe('03:30');
  });

  it('shifts dates', () => {
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30');
  });
});

describe('isAllowedEntryTime', () => {
  it('allows the past and now, not the future', () => {
    const now = 1_000_000;
    expect(isAllowedEntryTime(now - 1, now)).toBe(true);
    expect(isAllowedEntryTime(now + 60_000, now)).toBe(true);
    expect(isAllowedEntryTime(now + 60_001, now)).toBe(false);
    expect(isAllowedEntryTime(Number.NaN, now)).toBe(false);
  });
});
