import { eq } from 'drizzle-orm';

import type { LanguagePreference } from '../../domain/language';
import {
  languagePreferenceSchema,
  themePreferenceSchema,
  type ThemePreference,
} from '../../domain/schemas';
import { appMeta } from '../schema';
import type { AppDb } from '../types';

export const THEME_KEY = 'theme';
export const COOK_VIEW_KEY = 'cook_view';
export const PHOTO_CLEANUP_KEY = 'photo_cleanup_at';
export const LANGUAGE_KEY = 'language';
export const COOK_VIEWS = ['steps', 'overview'] as const;
export type CookView = (typeof COOK_VIEWS)[number];

export function createSettingsRepo(db: AppDb) {
  const setMeta = (key: string, value: string) =>
    db
      .insert(appMeta)
      .values({ key, value })
      .onConflictDoUpdate({ target: appMeta.key, set: { value } })
      .run();

  return {
    /** Cooking screen layout: step by step, or the whole recipe on one page. */
    setCookView(view: CookView): void {
      if (!COOK_VIEWS.includes(view)) throw new RangeError(`Unknown cook view ${view}`);
      setMeta(COOK_VIEW_KEY, view);
    },

    /** When the orphan-photo sweep last ran (epoch ms), or null. */
    getPhotoCleanupAt(): number | null {
      const row = db.select().from(appMeta).where(eq(appMeta.key, PHOTO_CLEANUP_KEY)).get();
      const value = row ? Number(row.value) : Number.NaN;
      return Number.isFinite(value) ? value : null;
    },

    setPhotoCleanupAt(ms: number): void {
      setMeta(PHOTO_CLEANUP_KEY, String(ms));
    },

    getLanguage(): LanguagePreference {
      const row = db.select().from(appMeta).where(eq(appMeta.key, LANGUAGE_KEY)).get();
      const parsed = languagePreferenceSchema.safeParse(row?.value);
      return parsed.success ? parsed.data : 'system';
    },

    setLanguage(value: LanguagePreference): void {
      setMeta(LANGUAGE_KEY, languagePreferenceSchema.parse(value));
    },

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
