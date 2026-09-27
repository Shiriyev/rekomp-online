import { eq } from 'drizzle-orm';

import { themePreferenceSchema, type ThemePreference } from '../../domain/schemas';
import { appMeta } from '../schema';
import type { AppDb } from '../types';

export const THEME_KEY = 'theme';

export function createSettingsRepo(db: AppDb) {
  return {
    getTheme(): ThemePreference {
      const row = db.select().from(appMeta).where(eq(appMeta.key, THEME_KEY)).get();
      const parsed = themePreferenceSchema.safeParse(row?.value);
      return parsed.success ? parsed.data : 'system';
    },

    setTheme(value: ThemePreference): void {
      const theme = themePreferenceSchema.parse(value);
      db.insert(appMeta)
        .values({ key: THEME_KEY, value: theme })
        .onConflictDoUpdate({ target: appMeta.key, set: { value: theme } })
        .run();
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
