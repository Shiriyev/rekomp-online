import { currentLocale, t } from '@/i18n';

// One formatter per locale and kind; the UI language can change at runtime.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
const numberFormat = (maxFraction: number) => {
  const key = `n${maxFraction}:${currentLocale()}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: maxFraction });
    cache.set(key, f);
  }
  return f;
};
const dateFormat = (kind: string, options: Intl.DateTimeFormatOptions) => {
  const key = `d${kind}:${currentLocale()}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(currentLocale(), options);
    cache.set(key, f);
  }
  return f;
};

/** "2 150" / "2,150" */
export const formatInt = (n: number): string => numberFormat(0).format(Math.round(n));

/** "82,5" / "82.5" */
export const formatDecimal = (n: number): string => numberFormat(1).format(n);

export const formatKcal = (n: number): string => t('common.kcalValue', { value: formatInt(n) });

export const formatGrams = (n: number): string => `${formatDecimal(n)} ${t('common.grams')}`;

const unitLabel = (unit: 'g' | 'ml' | 'pcs') => t(`common.units.${unit}`);

/** "250 г", "120 мл", "½ шт", "1½ шт", "2 шт" (localised units). */
export function formatAmount(amount: number, unit: 'g' | 'ml' | 'pcs'): string {
  if (unit !== 'pcs') return `${formatInt(amount)} ${unitLabel(unit)}`;
  const whole = Math.floor(amount + 1e-9);
  const rest = amount - whole;
  if (Math.abs(rest - 0.5) < 1e-9) return `${whole > 0 ? whole : ''}½ ${unitLabel('pcs')}`;
  return `${formatDecimal(amount)} ${unitLabel('pcs')}`;
}

/** "02.10" (ru) / "02/10" (en) for a YYYY-MM-DD date. */
export const formatDayMonth = (localDate: string): string => {
  const sep = currentLocale().startsWith('ru') ? '.' : '/';
  return `${localDate.slice(8, 10)}${sep}${localDate.slice(5, 7)}`;
};

/** Russian plural form: pluralRu(3, ['порция', 'порции', 'порций']) → 'порции'. */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** «Сегодня», «Вчера», otherwise «пн, 21 сентября» / «Mon 21 September». */
export function formatDayLabel(localDate: string, today: string, yesterday: string): string {
  if (localDate === today) return t('common.today');
  if (localDate === yesterday) return t('common.yesterday');
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return dateFormat('weekdayDay', { weekday: 'short', day: 'numeric', month: 'long' }).format(
    new Date(y, m - 1, d),
  );
}

/** «17:12» in the device time zone (24-hour in both languages). */
export const formatTime = (timestampMs: number): string =>
  dateFormat('hm', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(timestampMs),
  );

/** Long date for the backup dialog: «1 октября 2026» / «1 October 2026». */
export const formatLongDate = (ms: number): string =>
  dateFormat('long', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
