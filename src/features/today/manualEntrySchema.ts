import { z } from 'zod';

import { manualLogInputSchema } from '@/domain/schemas';
import { MEAL_TYPES } from '@/domain/types';
import { numberText } from '@/features/forms/numberText';

/** Text form values for a manual entry → ManualLogInput. */
export const manualEntryFormSchema = z
  .object({
    name: z.string().trim().min(1, 'validation.required').max(80, 'validation.maxLength|80'),
    kcal: numberText({ min: 0, max: 5000 }, true),
    protein: numberText({ min: 0, max: 500 }),
    mealType: z.enum(MEAL_TYPES),
  })
  .pipe(manualLogInputSchema);

export type ManualEntryFormValues = z.input<typeof manualEntryFormSchema>;
