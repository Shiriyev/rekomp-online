import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

const DB_NAME = 'rekomp.db';

const expoDb = openDatabaseSync(DB_NAME, { enableChangeListener: true });
// Foreign keys are off by default in SQLite and must be enabled per connection.
expoDb.execSync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

export const db = drizzle(expoDb, { schema });
