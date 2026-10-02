import { z } from 'zod';

import { MEAL_TYPES, UNITS } from '../../domain/types';

/**
 * The bundled catalog (src/db/seed/catalog.v2.json), built by tools/data-pipeline.
 * Only catalog data lives here; user data (pantry, logs, prices, photos) never does.
 */

/** PHASE_2 product categories, each with its subcategories. */
export const CATALOG_CATEGORIES = {
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
export type CatalogCategory = keyof typeof CATALOG_CATEGORIES;

export const PRODUCT_TAGS = [
  'vegetarian',
  'vegan',
  'pork',
  'alcohol',
  'lactose',
  'gluten',
] as const;

const id = z.string().regex(/^[A-Za-z0-9_]+$/);
const text = z.string().trim().min(1);
const per100 = (max: number) => z.number().min(0).max(max);

export const catalogIngredientSchema = z
  .object({
    id,
    name: text,
    nameEn: text,
    nameHu: text.nullable(),
    synonyms: z.array(text),
    category: z.enum(Object.keys(CATALOG_CATEGORIES) as [CatalogCategory, ...CatalogCategory[]]),
    subcategory: text,
    unit: z.enum(UNITS),
    gramsPerPiece: z.number().positive().nullable(),
    // Pure fats are ~900 (USDA lard: 902).
    kcalPer100g: per100(910),
    proteinPer100g: per100(100),
    fatPer100g: per100(100).nullable(),
    carbsPer100g: per100(100).nullable(),
    isStaple: z.boolean(),
    tags: z.array(z.enum(PRODUCT_TAGS)),
    source: z.enum(['usda', 'manual']),
    /** USDA FoodData Central fdcId when source = usda. */
    sourceId: text.nullable(),
    imageKey: text.nullable(),
  })
  .strict();

export const catalogVariantSchema = z
  .object({
    id,
    ingredientId: id,
    title: text,
    brand: text.nullable(),
    packageSize: z.number().positive(),
    packageUnit: z.enum(UNITS),
    barcode: text.nullable(),
    /** Label values when known; otherwise the canonical product's are used. */
    kcalPer100g: per100(900).nullable(),
    proteinPer100g: per100(100).nullable(),
    imageKey: text.nullable(),
    source: z.enum(['own', 'off']),
    sourceId: text.nullable(),
  })
  .strict();

export const catalogRecipeSchema = z
  .object({
    id,
    name: text,
    nameEn: text,
    descriptionRu: text.nullable(),
    descriptionEn: text.nullable(),
    cuisine: text.nullable(),
    mealType: z.enum(MEAL_TYPES),
    mealTypes: z.array(z.enum(MEAL_TYPES)).min(1),
    defaultServings: z.number().int().min(1).max(12),
    isBatch: z.boolean(),
    prepNightBefore: z.boolean(),
    totalMinutes: z.number().int().positive(),
    imageKey: text.nullable(),
    tags: z.array(z.enum(PRODUCT_TAGS)),
    source: z.enum(['own', 'mealdb']),
    sourceId: text.nullable(),
    sortOrder: z.number().int().min(0),
    /** Precomputed from the lines for sorting and filtering (task 10). */
    ingredientCount: z.number().int().positive(),
    kcalPerServing: z.number().positive(),
    proteinPerServing: z.number().min(0),
    /** Protein grams per 100 kcal. */
    proteinDensity: z.number().min(0),
  })
  .strict();

export const catalogLineSchema = z
  .object({
    recipeId: id,
    ingredientId: id,
    amountPerServing: z.number().min(0),
    unit: z.enum(UNITS),
    optional: z.boolean(),
    altGroup: text.nullable(),
    sortOrder: z.number().int().min(0),
    note: text.nullable(),
    noteEn: text.nullable(),
  })
  .strict();

export const catalogStepSchema = z
  .object({
    recipeId: id,
    order: z.number().int().positive(),
    text,
    textEn: text,
    timerSec: z.number().int().positive().nullable(),
    ingredientRefs: z.array(id),
  })
  .strict();

export const catalogSchema = z
  .object({
    catalogVersion: z.number().int().positive(),
    ingredients: z.array(catalogIngredientSchema),
    productVariants: z.array(catalogVariantSchema),
    recipes: z.array(catalogRecipeSchema),
    recipeIngredients: z.array(catalogLineSchema),
    recipeSteps: z.array(catalogStepSchema),
  })
  .strict();

export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogIngredient = z.infer<typeof catalogIngredientSchema>;
export type CatalogVariant = z.infer<typeof catalogVariantSchema>;
export type CatalogRecipe = z.infer<typeof catalogRecipeSchema>;
export type CatalogLine = z.infer<typeof catalogLineSchema>;
export type CatalogStep = z.infer<typeof catalogStepSchema>;
