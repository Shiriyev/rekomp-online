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

export const ingredients = sqliteTable('ingredients', {
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
  /** «Заканчивается» below this amount (ingredient unit); null = default by unit. */
  lowStockThreshold: real('low_stock_threshold'),
});

export const lidlProducts = sqliteTable(
  'lidl_products',
  {
    id: text('id').primaryKey(),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    packageSize: real('package_size').notNull(),
    packageUnit: text('package_unit', { enum: UNITS }).notNull(),
    priceHuf: integer('price_huf'),
    onSale: integer('on_sale', { mode: 'boolean' }).notNull().default(false),
    /** Inclusive last day of the sale, YYYY-MM-DD. */
    saleUntil: text('sale_until'),
    barcode: text('barcode').unique(),
    notes: text('notes'),
  },
  (t) => [index('lidl_products_ingredient_idx').on(t.ingredientId)],
);

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  mealType: text('meal_type', { enum: MEAL_TYPES }).notNull(),
  defaultServings: integer('default_servings').notNull().default(1),
  isBatch: integer('is_batch', { mode: 'boolean' }).notNull().default(false),
  prepNightBefore: integer('prep_night_before', { mode: 'boolean' }).notNull().default(false),
  totalMinutes: integer('total_minutes').notNull(),
  imageKey: text('image_key'),
  tags: text('tags', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  sortOrder: integer('sort_order').notNull().default(0),
});

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
});

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
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type LidlProduct = typeof lidlProducts.$inferSelect;
export type NewLidlProduct = typeof lidlProducts.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type RecipeStep = typeof recipeSteps.$inferSelect;
export type PantryItem = typeof pantryItems.$inferSelect;
export type CookSession = typeof cookSessions.$inferSelect;
export type PreparedPortion = typeof preparedPortions.$inferSelect;
export type MealLog = typeof mealLogs.$inferSelect;
export type NewMealLog = typeof mealLogs.$inferInsert;
export type Profile = typeof profile.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type NewProfile = typeof profile.$inferInsert;
