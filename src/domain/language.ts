/** UI languages. Russian is the original; English covers the UI and the built-in content. */
export const LANGUAGES = ['ru', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** What the user picked in the profile; «system» follows the phone. */
export const LANGUAGE_PREFERENCES = ['system', 'ru', 'en'] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

// Phones set to these languages read Russian more easily than English.
const RUSSIAN_READERS = new Set(['ru', 'uk', 'be', 'kk', 'ky', 'uz', 'tg', 'tk', 'az', 'hy', 'ka']);

/** The language to show for a preference, given the phone's languages in priority order. */
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageCodes: readonly (string | null | undefined)[],
): Language {
  if (preference !== 'system') return preference;
  for (const code of deviceLanguageCodes) {
    const c = code?.toLowerCase();
    if (!c) continue;
    if (c === 'en') return 'en';
    if (RUSSIAN_READERS.has(c)) return 'ru';
  }
  return 'en';
}

/** Intl locale used for numbers and dates. */
export const intlLocale = (language: Language): string => (language === 'ru' ? 'ru-RU' : 'en-GB');
