import {
  formatAmount,
  formatDayLabel,
  formatDayMonth,
  formatDecimal,
  formatInt,
  formatKcal,
} from '@/lib/format';

import { applyLanguage, currentLanguage, currentLocale, i18n, t, translateMessage } from '..';

afterEach(() => applyLanguage('ru'));

describe('language switching', () => {
  it('starts in Russian and switches to English', () => {
    expect(currentLanguage()).toBe('ru');
    expect(t('common.actions.save')).toBe('Сохранить');
    applyLanguage('en');
    expect(currentLanguage()).toBe('en');
    expect(currentLocale()).toBe('en-GB');
    expect(t('common.actions.save')).toBe('Save');
  });

  it('formats numbers, units and dates for the language', () => {
    applyLanguage('en');
    expect(formatInt(2150)).toBe('2,150');
    expect(formatDecimal(82.5)).toBe('82.5');
    expect(formatKcal(2150)).toBe('2,150 kcal');
    expect(formatAmount(250, 'g')).toBe('250 g');
    expect(formatAmount(1.5, 'pcs')).toBe('1½ pcs');
    expect(formatDayMonth('2026-10-02')).toBe('02/10');
    expect(formatDayLabel('2026-10-01', '2026-10-01', '2026-09-30')).toBe('Today');
    expect(formatDayLabel('2026-09-30', '2026-10-01', '2026-09-30')).toBe('Yesterday');
  });

  it('uses Russian plural forms', () => {
    expect(t('bulkAdd.added', { count: 1 })).toBe('Добавлен 1 продукт');
    expect(t('bulkAdd.added', { count: 3 })).toBe('Добавлено 3 продукта');
    expect(t('bulkAdd.added', { count: 6 })).toBe('Добавлено 6 продуктов');
    applyLanguage('en');
    expect(t('bulkAdd.added', { count: 1 })).toBe('Added 1 product');
    expect(t('bulkAdd.added', { count: 6 })).toBe('Added 6 products');
  });
});

describe('translateMessage', () => {
  it('translates keys, with an optional number, and passes plain text through', () => {
    expect(translateMessage('validation.required')).toBe('Введите название');
    expect(translateMessage('validation.min|5')).toBe('Не меньше 5');
    applyLanguage('en');
    expect(translateMessage('validation.max|80')).toBe('At most 80');
    expect(translateMessage('errors.backup.corrupt|meal_logs[0].kcal')).toBe(
      'The backup file is damaged (meal_logs[0].kcal)',
    );
    expect(translateMessage('Network down')).toBe('Network down');
    expect(translateMessage(undefined)).toBe('');
  });
});

describe('resources', () => {
  it('has every Russian key in English', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
      );
    const ru = keys(i18n.getResourceBundle('ru', 'translation') as object).sort();
    const en = keys(i18n.getResourceBundle('en', 'translation') as object).sort();
    expect(en).toEqual(ru);
  });
});
