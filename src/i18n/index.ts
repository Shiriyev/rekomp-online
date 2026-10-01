// Hermes may lack Intl.PluralRules, which i18next needs for plural keys.
import 'intl-pluralrules';

import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import { intlLocale, type Language } from '@/domain/language';
import type { Unit } from '@/domain/types';

import { en } from './en';
import { ru } from './ru';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ru };
  }
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, en: { translation: en } },
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  returnNull: false,
  // Resources are bundled: initialise synchronously so the first render is translated.
  initAsync: false,
  // The app tree remounts on a language switch, so components need not subscribe to it
  // (which also makes switching during the shell's render safe).
  react: { bindI18n: '', bindI18nStore: '' },
});

export { i18n };

/** Current UI language. */
export const currentLanguage = (): Language => (i18n.language === 'en' ? 'en' : 'ru');

/** Intl locale for the current language ('ru-RU' / 'en-GB'). */
export const currentLocale = (): string => intlLocale(currentLanguage());

/** Switches the UI language (resources are in memory, so this is immediate). */
export function applyLanguage(language: Language): void {
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

/** Typed `t` for components. */
export function useT() {
  return useTranslation().t;
}

/** Typed `t` outside React (undo messages, notifications, stores). */
export const t = i18n.t.bind(i18n);

/** «г» / «g» for a unit. */
export function useUnitLabel(): (unit: Unit) => string {
  const tr = useT();
  return (unit) => tr(`common.units.${unit}`);
}

/**
 * Validation and domain errors carry message keys («validation.required», optionally with a
 * number: «validation.min|5»). Plain text (from older code or the OS) is shown as is.
 */
export function translateMessage(message: string | undefined): string {
  if (!message) return '';
  const [key, param] = message.split('|');
  if (!key || !i18n.exists(key)) return message;
  // Keys are validated at runtime above; the typed `t` cannot know them statically here.
  return (i18n.t as (k: string, o?: object) => string)(
    key,
    param === undefined ? {} : { n: param },
  );
}

export function useTranslateMessage(): (message: string | undefined) => string {
  useTranslation(); // re-render on language change
  return translateMessage;
}
