/** Reviewed mapping files (mappings/*.json), validated with zod on load. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { MAPPINGS } from '../lib/paths.ts';

export const CATEGORIES = {
  meat_poultry: ['chicken', 'turkey', 'beef', 'pork', 'mince', 'lamb_other'],
  fish_seafood: ['fresh_frozen', 'canned'],
  dairy_eggs: ['curd', 'yogurt_skyr', 'cheese', 'milk_cream', 'eggs'],
  grains_pasta_legumes: ['rice', 'pasta', 'grains', 'legumes'],
  vegetables: ['fresh', 'frozen', 'canned'],
  fruits_berries: ['fresh', 'frozen'],
  bread_bakery: ['bread'],
  sauces_oils_spices: ['sauces', 'oils', 'spices'],
  nuts_seeds: ['nuts', 'seeds'],
  other: ['other'],
} as const;
export type Category = keyof typeof CATEGORIES;

export const TAGS = ['vegetarian', 'vegan', 'pork', 'alcohol', 'lactose', 'gluten'] as const;

const macros = z.object({
  kcal: z.number().min(0).max(900),
  protein: z.number().min(0).max(100),
  fat: z.number().min(0).max(100).nullable(),
  carbs: z.number().min(0).max(100).nullable(),
});

export const canonicalSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    nameEn: z.string().min(1),
    category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
    subcategory: z.string().min(1),
    unit: z.enum(['g', 'ml', 'pcs']),
    gramsPerPiece: z.number().positive().nullable(),
    usdaFdcId: z.number().int().positive().nullable(),
    manualMacros: macros.nullable(),
    isStaple: z.boolean(),
    tags: z.array(z.enum(TAGS)),
    synonyms: z.array(z.string()),
  })
  .refine((c) => (CATEGORIES[c.category] as readonly string[]).includes(c.subcategory), {
    message: 'subcategory does not belong to the category',
  })
  .refine((c) => c.unit !== 'pcs' || c.gramsPerPiece !== null, {
    message: 'pcs products need gramsPerPiece',
  })
  .refine((c) => c.usdaFdcId !== null || c.manualMacros !== null, {
    message: 'needs a USDA record or manual macros',
  });
export type Canonical = z.infer<typeof canonicalSchema>;

const ingredientMapSchema = z.object({
  map: z.record(z.string(), z.string()),
  unmapped: z.record(z.string(), z.string()),
});

const translationsSchema = z.record(
  z.string(),
  z.object({ ru: z.string().min(1), hu: z.string().min(1) }),
);

/** Grams for non-weight units: per product first, then generic defaults. */
const unitGramsSchema = z.object({
  default: z.record(z.string(), z.number().positive()),
  perProduct: z.record(z.string(), z.record(z.string(), z.number().positive())),
});
export type UnitGrams = z.infer<typeof unitGramsSchema>;

const read = <T>(file: string, schema: z.ZodType<T>, fallback?: T): T => {
  const p = path.join(MAPPINGS, file);
  if (!existsSync(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing ${p}`);
  }
  return schema.parse(JSON.parse(readFileSync(p, 'utf8')));
};

export function loadMappings() {
  return {
    canonical: read('canonical.json', z.array(canonicalSchema)),
    ingredientMap: read('ingredient-map.json', ingredientMapSchema),
    translations: read('translations.json', translationsSchema),
    unitGrams: read('unit-grams.json', unitGramsSchema),
  };
}
