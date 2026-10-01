import { intlLocale, resolveLanguage } from '../language';

describe('resolveLanguage', () => {
  it('uses an explicit choice', () => {
    expect(resolveLanguage('en', ['ru'])).toBe('en');
    expect(resolveLanguage('ru', ['en'])).toBe('ru');
  });

  it('follows the first phone language it knows', () => {
    expect(resolveLanguage('system', ['ru'])).toBe('ru');
    expect(resolveLanguage('system', ['EN'])).toBe('en');
    expect(resolveLanguage('system', ['uk', 'en'])).toBe('ru');
    expect(resolveLanguage('system', [null, 'hu', 'en'])).toBe('en');
  });

  it('falls back to English for other languages', () => {
    expect(resolveLanguage('system', ['hu'])).toBe('en');
    expect(resolveLanguage('system', [])).toBe('en');
  });
});

describe('intlLocale', () => {
  it('maps to Intl locales', () => {
    expect(intlLocale('ru')).toBe('ru-RU');
    expect(intlLocale('en')).toBe('en-GB');
  });
});
