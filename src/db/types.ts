import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Driver-agnostic handle: expo-sqlite in the app, better-sqlite3 in tests.
 * Transactions satisfy this type too, so repositories can run inside one.
 */
export type AppDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
