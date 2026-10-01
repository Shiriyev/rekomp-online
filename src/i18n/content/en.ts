/**
 * English for the built-in (seeded) content. Keyed by seed ids so the database keeps the
 * Russian original; user-created products and manual entries are never translated.
 * Filled for every recipe in src/db/seed/recipes.ts and ingredient in src/db/seed/ingredients.ts.
 */
export type RecipeContent = {
  name: string;
  /** One per seed step, in order. */
  steps: string[];
  /** Line notes («1 ч.л.») by ingredient id. */
  notes?: Record<string, string>;
};

export const RECIPES_EN: Record<string, RecipeContent> = {};

export const INGREDIENTS_EN: Record<string, string> = {};

/** Recipe tags («с вечера»). */
export const TAGS_EN: Record<string, string> = {};
