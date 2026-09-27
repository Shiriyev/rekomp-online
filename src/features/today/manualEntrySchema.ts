import { z } from 'zod';

import { manualLogInputSchema } from '@/domain/schemas';
import { MEAL_TYPES } from '@/domain/types';
import { numberText } from '@/features/forms/numberText';

/** Text form values for a manual entry → ManualLogInput. */
export const manualEntryFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Введите название').max(80, 'Не длиннее 80 символов'),
    kcal: numberText({ min: 0, max: 5000 }, true),
    protein: numberText({ min: 0, max: 500 }),
    mealType: z.enum(MEAL_TYPES),
  })
  .pipe(manualLogInputSchema);

export type ManualEntryFormValues = z.input<typeof manualEntryFormSchema>;
