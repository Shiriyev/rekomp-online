// Relative imports only: this file is also loaded by drizzle-kit outside Metro.
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import {
  ACTIVITY_LEVELS,
  INGREDIENT_CATEGORIES,
  MEAL_LOG_SOURCES,
  MEAL_TYPES,
  SEXES,
  UNITS,
  type GoalRate,
} from '../domain/types';

type MealTypeValue = (typeof MEAL_TYPES)[number];

/** Timer of one step; wall-clock based so it survives the app being killed. */
export type CookTimer = {
  stepOrder: number;
  durationSec: number;
  /** Epoch ms when the current run started; null while paused/idle. */
  startedAt: number | null;
  /** Seconds already elapsed in earlier runs (before pauses). */
  elapsedSec: number;
  notificationId: string | null;
};

export type CookProgress = { stepIndex: number; checked: string[]; timers: CookTimer[] };

/** Per-ingredient amounts moved by a cook session, used for Undo. Positive = consumed. */
export type PantryDelta = { ingredientId: string; amount: number; unit: (typeof UNITS)[number] }[];

export const ingredients = sqliteTable(
  'ingredients',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    nameHu: text('name_hu'),
    category: text('category', { enum: INGREDIENT_CATEGORIES }).notNull(),
    unit: text('unit', { enum: UNITS }).notNull(),
    gramsPerPiece: real('grams_per_piece'),
    kcalPer100g: real('kcal_per_100g').notNull(),
    proteinPer100g: real('protein_per_100g').notNull(),
    isStaple: integer('is_staple', { mode: 'boolean' }).notNull().default(false),
    imageKey: text('image_key'),
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
    // ---- catalog (PHASE_2): rewritten by the catalog update, never by the user ----
    nameEn: text('name_en'),
    synonyms: text('synonyms', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    subcategory: text('subcategory'),
    fatPer100g: real('fat_per_100g'),
    carbsPer100g: real('carbs_per_100g'),
    tags: text('tags', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    /** usda | manual (catalog) | own (user-created). */
    source: text('source').notNull().default('own'),
    sourceId: text('source_id'),
    /** Left the catalog but still referenced: hidden from pickers, kept for history/«Дома». */
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    /** The user changed nutrition or piece weight: catalog updates keep the user's values. */
    nutritionEdited: integer('nutrition_edited', { mode: 'boolean' }).notNull().default(false),
    /** false: not tracked at home (broth: water and a cube) — never «missing», not deducted. */
    stockTracked: integer('stock_tracked', { mode: 'boolean' }).notNull().default(true),
    /** «Заканчивается» below this amount (ingredient unit); null = default by unit. */
    lowStockThreshold: real('low_stock_threshold'),
    /** What was added «Домой» last time (ingredient unit): the next default amount. */
    lastAddedAmount: real('last_added_amount'),
  },
  (t) => [
    index('ingredients_category_idx').on(t.category),
    index('ingredients_archived_idx').on(t.isArchived),
  ],
);

export const recipes = sqliteTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    mealType: text('meal_type', { enum: MEAL_TYPES }).notNull(),
    defaultServings: integer('default_servings').notNull().default(1),
    /** Cooked for several days (stews, soups): only the «готовится на 3–4 дня» filter. */
    isBatch: integer('is_batch', { mode: 'boolean' }).notNull().default(false),
    /** How many days the cooked dish keeps in the fridge (catalog, reviewed). */
    storageDays: integer('storage_days').notNull().default(3),
    prepNightBefore: integer('prep_night_before', { mode: 'boolean' }).notNull().default(false),
    totalMinutes: integer('total_minutes').notNull(),
    imageKey: text('image_key'),
    /** The user's own photo of the dish (documents/meal-photos); replaces the bundled one. */
    photoUri: text('photo_uri'),
    tags: text('tags', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    sortOrder: integer('sort_order').notNull().default(0),
    // ---- catalog (PHASE_2) ----
    nameEn: text('name_en'),
    descriptionRu: text('description_ru'),
    descriptionEn: text('description_en'),
    cuisine: text('cuisine'),
    /** Every meal the recipe fits (meal_type is the primary one). */
    mealTypes: text('meal_types', { mode: 'json' })
      .$type<MealTypeValue[]>()
      .notNull()
      .default(sql`'[]'`),
    /** own | mealdb */
    source: text('source').notNull().default('own'),
    sourceId: text('source_id'),
    ingredientCount: integer('ingredient_count').notNull().default(0),
    /** Precomputed for sorting/filtering; the screens still compute from the lines. */
    kcalPerServing: real('kcal_per_serving').notNull().default(0),
    proteinPerServing: real('protein_per_serving').notNull().default(0),
    proteinDensity: real('protein_density').notNull().default(0),
    /** Equipment the steps need (stove, oven, blender…), for the «нет плиты» filters. */
    equipment: text('equipment', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    /** Where most of the protein comes from (poultry, fish, …), for the shelves. */
    mainProtein: text('main_protein').notNull().default('other'),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    index('recipes_meal_type_idx').on(t.mealType),
    index('recipes_archived_idx').on(t.isArchived),
  ],
);

export const recipeIngredients = sqliteTable(
  'recipe_ingredients',
  {
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'restrict' }),
    amountPerServing: real('amount_per_serving').notNull(),
    unit: text('unit', { enum: UNITS }).notNull(),
    optional: integer('optional', { mode: 'boolean' }).notNull().default(false),
    /** Lines with the same group are interchangeable (e.g. skyr or greek yogurt). */
    altGroup: text('alt_group'),
    sortOrder: integer('sort_order').notNull().default(0),
    note: text('note'),
    noteEn: text('note_en'),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.ingredientId] }),
    index('recipe_ingredients_ingredient_idx').on(t.ingredientId),
  ],
);

export const recipeSteps = sqliteTable(
  'recipe_steps',
  {
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    order: integer('step_order').notNull(),
    text: text('text').notNull(),
    textEn: text('text_en'),
    timerSec: integer('timer_sec'),
    ingredientRefs: text('ingredient_refs', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.order] })],
);

export const pantryItems = sqliteTable(
  'pantry_items',
  {
    ingredientId: text('ingredient_id')
      .primaryKey()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    quantity: real('quantity').notNull(),
    unit: text('unit', { enum: UNITS }).notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [check('pantry_quantity_non_negative', sql`${t.quantity} >= 0`)],
);

export const cookSessions = sqliteTable('cook_sessions', {
  /** UUID generated when cooking starts; the idempotency key for finishing. */
  id: text('id').primaryKey(),
  recipeId: text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'restrict' }),
  servings: integer('servings').notNull(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  undoneAt: integer('undone_at'),
  abandonedAt: integer('abandoned_at'),
  /** Chosen alternatives for this cook, e.g. { yogurt: 'greek_yogurt' }. */
  choices: text('choices', { mode: 'json' })
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'`),
  /** UI progress (step, checked items, timers) so an interrupted session can resume. */
  progress: text('progress', { mode: 'json' }).$type<CookProgress>(),
  pantryDelta: text('pantry_delta', { mode: 'json' }).$type<PantryDelta>(),
  shortfall: text('shortfall', { mode: 'json' }).$type<PantryDelta>(),
  /** Snapshot at start of the per-serving amounts actually cooked (edited on the card). */
  amountOverrides: text('amount_overrides', { mode: 'json' })
    .$type<Record<string, number>>()
    .notNull()
    .default(sql`'{}'`),
  /** What the cook really used for all servings (ingredient unit), for the history. */
  usedAmounts: text('used_amounts', { mode: 'json' }).$type<PantryDelta>(),
});

/** Recipes the user saved («Избранное»): shown first on their meal pages. User data. */
export const favoriteRecipes = sqliteTable('favorite_recipes', {
  recipeId: text('recipe_id')
    .primaryKey()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
});

/** «Моя версия рецепта»: own default amounts; the seeded lines stay as the original. */
export const recipeCustomAmounts = sqliteTable(
  'recipe_custom_amounts',
  {
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    amountPerServing: real('amount_per_serving').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.ingredientId] }),
    check('recipe_custom_amount_non_negative', sql`${t.amountPerServing} >= 0`),
  ],
);

export const preparedPortions = sqliteTable(
  'prepared_portions',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'restrict' }),
    cookSessionId: text('cook_session_id').references(() => cookSessions.id, {
      onDelete: 'set null',
    }),
    portionsLeft: integer('portions_left').notNull(),
    kcalPerPortion: integer('kcal_per_portion').notNull(),
    proteinPerPortion: real('protein_per_portion').notNull(),
    cookedAt: integer('cooked_at').notNull(),
    /** The recipe's storage days when it was cooked; null for portions cooked before v2.1. */
    storageDays: integer('storage_days'),
  },
  (t) => [check('portions_left_non_negative', sql`${t.portionsLeft} >= 0`)],
);

export const mealLogs = sqliteTable(
  'meal_logs',
  {
    id: text('id').primaryKey(),
    /** UTC milliseconds. */
    timestamp: integer('timestamp').notNull(),
    /** Logical day (domain/day.ts getLogicalDate), YYYY-MM-DD. */
    localDate: text('local_date').notNull(),
    mealType: text('meal_type', { enum: MEAL_TYPES }).notNull(),
    source: text('source', { enum: MEAL_LOG_SOURCES }).notNull(),
    recipeId: text('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    kcal: integer('kcal').notNull(),
    protein: real('protein').notNull(),
    servings: real('servings').notNull().default(1),
    cookSessionId: text('cook_session_id').references(() => cookSessions.id, {
      onDelete: 'set null',
    }),
    /** Set when a prepared portion was eaten, so Undo can put it back. */
    portionId: text('portion_id').references(() => preparedPortions.id, { onDelete: 'set null' }),
    /** Own photo (file:// in documents/meal-photos); takes priority over the recipe image. */
    photoUri: text('photo_uri'),
    /** Manual entries: products taken from the pantry with it (positive = taken), for Undo. */
    pantryDelta: text('pantry_delta', { mode: 'json' }).$type<PantryDelta>(),
  },
  (t) => [
    index('meal_logs_local_date_idx').on(t.localDate),
    index('meal_logs_cook_session_idx').on(t.cookSessionId),
  ],
);

export const profile = sqliteTable(
  'profile',
  {
    /** Single-row table. */
    id: integer('id').primaryKey().default(1),
    sex: text('sex', { enum: SEXES }).notNull(),
    age: integer('age').notNull(),
    heightCm: real('height_cm').notNull(),
    weightKg: real('weight_kg').notNull(),
    activityLevel: text('activity_level', { enum: ACTIVITY_LEVELS }).notNull(),
    goalRateKgPerWeek: real('goal_rate_kg_per_week').$type<GoalRate>().notNull(),
    kcalTarget: integer('kcal_target').notNull(),
    proteinTargetG: integer('protein_target_g').notNull(),
    proteinMinG: integer('protein_min_g').notNull(),
    targetOverridden: integer('target_overridden', { mode: 'boolean' }).notNull().default(false),
    /** The logical day starts at this local hour (0–6): food before it counts for yesterday. */
    dayStartHour: integer('day_start_hour').notNull().default(4),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    check('profile_single_row', sql`${t.id} = 1`),
    check('profile_day_start_hour_range', sql`${t.dayStartHour} BETWEEN 0 AND 6`),
  ],
);

export const weightLogs = sqliteTable('weight_logs', {
  localDate: text('local_date').primaryKey(),
  weightKg: real('weight_kg').notNull(),
});

/** Shopping list. At most one open (unchecked) item per ingredient. */
export const shoppingItems = sqliteTable(
  'shopping_items',
  {
    id: text('id').primaryKey(),
    ingredientId: text('ingredient_id').references(() => ingredients.id, { onDelete: 'set null' }),
    /** Free-text title for manual items; ingredient name is used otherwise. */
    title: text('title').notNull(),
    quantity: real('quantity'),
    unit: text('unit', { enum: UNITS }),
    checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
    /** What «купил» added to the pantry (ingredient unit), so un-checking can take it back. */
    addedQuantity: real('added_quantity'),
    createdAt: integer('created_at').notNull(),
    checkedAt: integer('checked_at'),
  },
  (t) => [
    uniqueIndex('shopping_items_open_ingredient_uq')
      .on(t.ingredientId)
      .where(sql`${t.checked} = 0 AND ${t.ingredientId} IS NOT NULL`),
  ],
);

/** Small key/value store for app metadata such as the applied seed version. */
/** Version of the bundled catalog last applied (key «catalogVersion»). Not backed up. */
export const catalogMeta = sqliteTable('catalog_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type RecipeStep = typeof recipeSteps.$inferSelect;
export type FavoriteRecipe = typeof favoriteRecipes.$inferSelect;
export type RecipeCustomAmount = typeof recipeCustomAmounts.$inferSelect;
export type PantryItem = typeof pantryItems.$inferSelect;
export type CookSession = typeof cookSessions.$inferSelect;
export type PreparedPortion = typeof preparedPortions.$inferSelect;
export type MealLog = typeof mealLogs.$inferSelect;
export type NewMealLog = typeof mealLogs.$inferInsert;
export type Profile = typeof profile.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type NewProfile = typeof profile.$inferInsert;
