import { z } from 'zod';

import { INGREDIENT_CATEGORIES, SHOPS, UNITS } from '@/domain/types';
import { numberText, optionalNumberText } from '@/features/forms/numberText';

/**
 * Text form values for an own product → CustomIngredientInput. It carries the domain
 * schema's piece-weight rule rather than piping into it, because zod's pipe is invariant
 * on the input type and that schema defaults two fields. createCustom parses the result
 * with the domain schema anyway, so nothing reaches the database unchecked.
 */
export const customProductFormSchema = z
  .object({
    name: z.string().trim().min(1, 'validation.required').max(60, 'validation.maxLength|60'),
    category: z.enum(INGREDIENT_CATEGORIES),
    unit: z.enum(UNITS),
    // Only asked for when the unit is pieces; the domain schema then requires it.
    gramsPerPiece: optionalNumberText({ min: 1, max: 5000 }),
    kcalPer100g: numberText({ min: 0, max: 900 }),
    proteinPer100g: numberText({ min: 0, max: 100 }),
    shops: z.array(z.enum(SHOPS)),
    photoUri: z.string().min(1).nullable(),
  })
  .refine((v) => v.unit !== 'pcs' || v.gramsPerPiece !== null, {
    path: ['gramsPerPiece'],
    message: 'validation.pieceWeight',
  });

export type CustomProductFormValues = z.input<typeof customProductFormSchema>;
