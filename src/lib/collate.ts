import { currentLocale } from '@/i18n';

const collators = new Map<string, Intl.Collator>();

/**
 * Compares names in the UI language. `a.localeCompare(b, locale)` creates a collator per
 * call on Hermes, which makes sorting a list visibly slow; this reuses one per locale.
 */
export function compareNames(a: string, b: string): number {
  const locale = currentLocale();
  let collator = collators.get(locale);
  if (!collator) {
    collator = new Intl.Collator(locale);
    collators.set(locale, collator);
  }
  return collator.compare(a, b);
}
