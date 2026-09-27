// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_meal_log_portion.sql';
import m0002 from './0002_shopping_items.sql';
import m0003 from './0003_cook_session_progress.sql';
import m0004 from './0004_pantry_thresholds.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
  },
};
