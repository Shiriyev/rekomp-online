import { z } from 'zod';

import { parseDecimal } from '@/domain/schemas';

/** A text input that must parse (comma or dot decimals) to a number within limits. */
export const numberText = (limits: { min: number; max: number }, int = false) => {
  const base = z.number({ error: 'Введите число' });
  return z
    .string()
    .transform(parseDecimal)
    .pipe(
      (int ? base.int('Нужно целое число') : base)
        .min(limits.min, `Не меньше ${limits.min}`)
        .max(limits.max, `Не больше ${limits.max}`),
    );
};
