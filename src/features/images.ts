/**
 * Bundled photos keyed by imageKey (recipes: "z1"…, ingredients: ingredient id).
 * Filled by scripts/fetch-images.ts in phase 8; missing keys fall back to an icon.
 */
export const RECIPE_IMAGES: Readonly<Record<string, number>> = {};
export const INGREDIENT_IMAGES: Readonly<Record<string, number>> = {};
