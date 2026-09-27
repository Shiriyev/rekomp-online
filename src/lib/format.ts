const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** "2 150" */
export const formatInt = (n: number): string => integer.format(Math.round(n));

/** "82,5" / "82" */
export const formatDecimal = (n: number): string => oneDecimal.format(n);

export const formatKcal = (n: number): string => `${formatInt(n)} ккал`;

export const formatGrams = (n: number): string => `${formatDecimal(n)} г`;

const UNIT_LABELS = { g: 'г', ml: 'мл', pcs: 'шт' } as const;

/** "250 г", "120 мл", "½ шт", "1½ шт", "2 шт". */
export function formatAmount(amount: number, unit: keyof typeof UNIT_LABELS): string {
  if (unit !== 'pcs') return `${formatInt(amount)} ${UNIT_LABELS[unit]}`;
  const whole = Math.floor(amount + 1e-9);
  const rest = amount - whole;
  if (Math.abs(rest - 0.5) < 1e-9) return `${whole > 0 ? whole : ''}½ ${UNIT_LABELS.pcs}`;
  return `${formatDecimal(amount)} ${UNIT_LABELS.pcs}`;
}

/** "02.10" for a YYYY-MM-DD date. */
export const formatDayMonth = (localDate: string): string =>
  `${localDate.slice(8, 10)}.${localDate.slice(5, 7)}`;

/** Russian plural form: pluralRu(3, ['порция', 'порции', 'порций']) → 'порции'. */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

const weekdayDay = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});

/** «Сегодня», «Вчера», otherwise «пн, 21 сентября». */
export function formatDayLabel(localDate: string, today: string, yesterday: string): string {
  if (localDate === today) return 'Сегодня';
  if (localDate === yesterday) return 'Вчера';
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return weekdayDay.format(new Date(y, m - 1, d));
}

const hourMinute = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** «17:12» in the device time zone. */
export const formatTime = (timestampMs: number): string => hourMinute.format(new Date(timestampMs));
