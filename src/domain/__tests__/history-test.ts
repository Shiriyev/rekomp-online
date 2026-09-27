import { averageOfLogged, dailySeries, dayVerdict } from '../history';

const targets = { kcalTarget: 2000, proteinMinG: 120 };

describe('dayVerdict', () => {
  it.each([
    [2000, 'ok'],
    [2100, 'ok'],
    [2101, 'over'],
    [1700, 'ok'],
    [1699, 'under'],
    [0, 'under'],
  ] as const)('%i kcal → %s', (kcal, verdict) => {
    expect(dayVerdict({ kcal, protein: 130 }, targets).kcal).toBe(verdict);
  });

  it('flags protein below the minimum', () => {
    expect(dayVerdict({ kcal: 2000, protein: 119.9 }, targets).protein).toBe('low');
    expect(dayVerdict({ kcal: 2000, protein: 120 }, targets).protein).toBe('ok');
  });
});

describe('dailySeries / averageOfLogged', () => {
  const byDate = new Map([
    ['2026-09-25', { kcal: 2000, protein: 140 }],
    ['2026-09-27', { kcal: 900, protein: 50 }],
  ]);

  it('fills missing days with zeros, oldest first', () => {
    expect(dailySeries(byDate, '2026-09-27', 3)).toEqual([
      { date: '2026-09-25', kcal: 2000, protein: 140, logged: true },
      { date: '2026-09-26', kcal: 0, protein: 0, logged: false },
      { date: '2026-09-27', kcal: 900, protein: 50, logged: true },
    ]);
  });

  it('averages logged days only and can leave today out', () => {
    const s = dailySeries(byDate, '2026-09-27', 7);
    expect(averageOfLogged(s)).toEqual({ kcal: 1450, protein: 95, days: 2 });
    expect(averageOfLogged(s, '2026-09-27')).toEqual({ kcal: 2000, protein: 140, days: 1 });
    expect(averageOfLogged(dailySeries(new Map(), '2026-09-27', 7))).toBeNull();
  });
});
