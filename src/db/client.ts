import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

const DB_NAME = 'rekomp.db';

function open(): SQLiteDatabase {
  const connection = openDatabaseSync(DB_NAME, { enableChangeListener: true });
  // Foreign keys are off by default in SQLite and must be enabled per connection.
  connection.execSync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  return connection;
}

// Reuse one native connection across Fast Refresh re-evaluations in development;
// opening a second one while the first is being released crashes prepared statements.
const holder = globalThis as typeof globalThis & { __rekompDb?: SQLiteDatabase };
const expoDb = holder.__rekompDb ?? open();
if (__DEV__) holder.__rekompDb = expoDb;

export const db = drizzle(expoDb, { schema });
