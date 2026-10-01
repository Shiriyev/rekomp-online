import { z } from 'zod';

import { parseDecimal } from '@/domain/schemas';

/** A text input that must parse (comma or dot decimals) to a number within limits. */
export const numberText = (limits: { min: number; max: number }, int = false) => {
  const base = z.number({ error: 'validation.number' });
  return z
    .string()
    .transform(parseDecimal)
    .pipe(
      (int ? base.int('validation.integer') : base)
        .min(limits.min, `validation.min|${limits.min}`)
        .max(limits.max, `validation.max|${limits.max}`),
    );
};

/** Like numberText, but an empty field means null. */
export const optionalNumberText = (limits: { min: number; max: number }, int = false) =>
  z.union([
    z
      .string()
      .trim()
      .length(0)
      .transform(() => null),
    numberText(limits, int),
  ]);
