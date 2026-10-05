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
import m0010 from './0010_recipe_photo.sql';
import m0011 from './0011_catalog.sql';
import m0012 from './0012_recipe_equipment.sql';
import m0013 from './0013_stock_tracked.sql';
import m0014 from './0014_favorite_recipes.sql';
import m0015 from './0015_drop_lidl_products.sql';
import m0016 from './0016_storage_days.sql';
import m0017 from './0017_hidden_recipes.sql';

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
m0010,
m0011,
m0012,
m0013,
m0014,
m0015,
m0016,
m0017
    }
  }
  