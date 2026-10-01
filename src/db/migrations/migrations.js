// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_meal_log_portion.sql';
import m0002 from './0002_shopping_items.sql';
import m0003 from './0003_cook_session_progress.sql';
import m0004 from './0004_pantry_thresholds.sql';
import m0005 from './0005_logical_day.sql';
import m0006 from './0006_meal_photo.sql';
import m0007 from './0007_meal_log_pantry_delta.sql';
import m0008 from './0008_ingredient_last_added.sql';
import m0009 from './0009_recipe_amounts.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
    m0008,
    m0009,
  },
};
