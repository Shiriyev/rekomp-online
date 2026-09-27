import {
  formatAmount,
  formatDayLabel,
  formatTime,
  formatDayMonth,
  formatDecimal,
  formatGrams,
  formatInt,
  formatKcal,
  pluralRu,
} from '../format';

// ru-RU groups thousands with a no-break space.
const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('format', () => {
  it('formats numbers the Russian way', () => {
    expect(nbsp(formatInt(2150.4))).toBe('2 150');
    expect(formatDecimal(82.5)).toBe('82,5');
    expect(nbsp(formatKcal(2150))).toBe('2 150 ккал');
    expect(formatGrams(61.44)).toBe('61,4 г');
  });

  it.each([
    [250, 'g', '250 г'],
    [120, 'ml', '120 мл'],
    [0.5, 'pcs', '½ шт'],
    [1.5, 'pcs', '1½ шт'],
    [2, 'pcs', '2 шт'],
    [0.25, 'pcs', '0,3 шт'],
  ] as const)('formatAmount(%p, %p) = %p', (amount, unit, expected) => {
    expect(formatAmount(amount, unit)).toBe(expected);
  });

  it('formats day and month', () => {
    expect(formatDayMonth('2026-10-02')).toBe('02.10');
  });
});

describe('pluralRu', () => {
  const forms = ['порция', 'порции', 'порций'] as const;
  it.each([
    [1, 'порция'],
    [2, 'порции'],
    [4, 'порции'],
    [5, 'порций'],
    [11, 'порций'],
    [12, 'порций'],
    [21, 'порция'],
    [22, 'порции'],
    [0, 'порций'],
  ])('%i → %s', (n, form) => {
    expect(pluralRu(n, forms)).toBe(form);
  });
});

describe('formatDayLabel / formatTime', () => {
  it('names today and yesterday, otherwise weekday and date', () => {
    expect(formatDayLabel('2026-09-27', '2026-09-27', '2026-09-26')).toBe('Сегодня');
    expect(formatDayLabel('2026-09-26', '2026-09-27', '2026-09-26')).toBe('Вчера');
    expect(formatDayLabel('2026-09-21', '2026-09-27', '2026-09-26')).toMatch(/пн.*21 сентября/);
  });

  it('formats local time', () => {
    expect(formatTime(Date.UTC(2026, 8, 27, 15, 12))).toBe('17:12');
  });
});
