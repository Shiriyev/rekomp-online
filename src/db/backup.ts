import { getTableColumns, type Column } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { dayStartHourOf, LOGICAL_DAY_MIGRATION_KEY, recomputeLocalDates } from './logicalDay';
import * as schema from './schema';
import { applyBundledCatalog } from './catalog/bundled';
import type { AppDb } from './types';

export const BACKUP_APP = 'rekomp';
export const BACKUP_FORMAT_VERSION = 1;

/** Insert order respects foreign keys; deletion runs in reverse. */
const TABLES = {
  ingredients: schema.ingredients,
  recipes: schema.recipes,
  recipe_ingredients: schema.recipeIngredients,
  recipe_steps: schema.recipeSteps,
  recipe_custom_amounts: schema.recipeCustomAmounts,
  favorite_recipes: schema.favoriteRecipes,
  lidl_products: schema.lidlProducts,
  pantry_items: schema.pantryItems,
  cook_sessions: schema.cookSessions,
  prepared_portions: schema.preparedPortions,
  meal_logs: schema.mealLogs,
  shopping_items: schema.shoppingItems,
  profile: schema.profile,
  weight_logs: schema.weightLogs,
  app_meta: schema.appMeta,
  // The catalog version travels with the data: restoring a backup made with this catalog
  // is exact; an older backup (without it) gets the bundled catalog applied on top.
  catalog_meta: schema.catalogMeta,
} as const satisfies Record<string, SQLiteTable>;

type TableName = keyof typeof TABLES;
const TABLE_NAMES = Object.keys(TABLES) as TableName[];

export type Backup = {
  app: typeof BACKUP_APP;
  formatVersion: number;
  exportedAt: number;
  tables: Record<TableName, Record<string, unknown>[]>;
};

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

/** Every row of every table, as stored (JSON columns already parsed). */
export function exportBackup(db: AppDb, now: number = Date.now()): Backup {
  const tables = Object.fromEntries(
    TABLE_NAMES.map((name) => [
      name,
      db.select().from(TABLES[name]).all() as Record<string, unknown>[],
    ]),
  ) as Backup['tables'];
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now, tables };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function checkValue(table: string, key: string, column: Column, value: unknown): void {
  // Technical detail stays in English; the UI wraps it in a translated sentence.
  const fail = (why: string) => {
    throw new BackupFormatError(`errors.backup.corrupt|${table}.${key}: ${why}`);
  };
  if (value === null || value === undefined) {
    if (column.notNull && !column.hasDefault) fail('required field is empty');
    return;
  }
  switch (column.dataType) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('number expected');
      break;
    case 'string':
      if (typeof value !== 'string') fail('string expected');
      break;
    case 'boolean':
      if (typeof value !== 'boolean') fail('boolean expected');
      break;
    case 'json':
      if (typeof value !== 'object') fail('object expected');
      break;
    default:
      break;
  }
}

/** Structural validation against the Drizzle column definitions; DB constraints do the rest. */
export function parseBackup(raw: unknown): Backup {
  if (!isPlainObject(raw) || raw.app !== BACKUP_APP) {
    throw new BackupFormatError('errors.backup.notBackup');
  }
  if (typeof raw.formatVersion !== 'number' || raw.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupFormatError('errors.backup.newerVersion');
  }
  if (!isPlainObject(raw.tables)) throw new BackupFormatError('errors.backup.noData');

  const tables = {} as Backup['tables'];
  for (const name of TABLE_NAMES) {
    const rows = raw.tables[name] ?? [];
    if (!Array.isArray(rows))
      throw new BackupFormatError(`errors.backup.corrupt|${name}: list expected`);
    const columns = getTableColumns(TABLES[name]) as Record<string, Column>;
    tables[name] = rows.map((row, i) => {
      if (!isPlainObject(row))
        throw new BackupFormatError(`errors.backup.corrupt|${name}[${i}]: record expected`);
      for (const key of Object.keys(row)) {
        if (!(key in columns))
          throw new BackupFormatError(`errors.backup.corrupt|${name}[${i}]: unknown field ${key}`);
      }
      for (const [key, column] of Object.entries(columns))
        checkValue(`${name}[${i}]`, key, column, row[key]);
      return row;
    });
  }
  return {
    app: BACKUP_APP,
    formatVersion: raw.formatVersion,
    exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
    tables,
  };
}

// SQLite limits bound parameters per statement; small batches stay well below it.
const BATCH = 40;

/**
 * Replaces all data with the backup in one transaction: on any error nothing changes.
 * Entries are re-filed under the logical-day rule (a v1 backup used calendar midnight).
 * The bundled catalog is then applied when it is newer than the backup's: an old backup
 * gets the current catalog, its own data (pantry, history, prices, own products) is kept.
 */
export function importBackup(db: AppDb, backup: Backup): void {
  db.transaction((tx) => {
    for (const name of [...TABLE_NAMES].reverse()) tx.delete(TABLES[name]).run();
    for (const name of TABLE_NAMES) {
      const rows = backup.tables[name];
      for (let i = 0; i < rows.length; i += BATCH) {
        // Rows were validated against these very columns in parseBackup.
        tx.insert(TABLES[name])
          .values(rows.slice(i, i + BATCH) as never)
          .run();
      }
    }
    recomputeLocalDates(tx, dayStartHourOf(tx));
    tx.insert(schema.appMeta)
      .values({ key: LOGICAL_DAY_MIGRATION_KEY, value: '1' })
      .onConflictDoNothing()
      .run();
  });
  applyBundledCatalog(db);
}

/** Deletes everything and restores the bundled catalog (the app returns to onboarding). */
export function resetAllData(db: AppDb): void {
  db.transaction((tx) => {
    for (const name of [...TABLE_NAMES].reverse()) tx.delete(TABLES[name]).run();
  });
  applyBundledCatalog(db);
}

export const backupFileName = (now: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `rekomp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
};
