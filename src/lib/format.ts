const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** "2 150" */
export const formatInt = (n: number): string => integer.format(Math.round(n));

/** "82,5" / "82" */
export const formatDecimal = (n: number): string => oneDecimal.format(n);

export const formatKcal = (n: number): string => `${formatInt(n)} ккал`;

export const formatGrams = (n: number): string => `${formatDecimal(n)} г`;
