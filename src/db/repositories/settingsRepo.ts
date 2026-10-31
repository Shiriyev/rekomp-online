import { UNSUPPORTED_PRODUCTS_KEY } from '../catalog/apply';
import { eq } from 'drizzle-orm';

import type { LanguagePreference } from '../../domain/language';
import {
  languagePreferenceSchema,
  themePreferenceSchema,
  type ThemePreference,
} from '../../domain/schemas';
import { SHOPS, type Shop } from '../../domain/types';
import { appMeta } from '../schema';
import type { AppDb } from '../types';

export const THEME_KEY = 'theme';
export const COOK_VIEW_KEY = 'cook_view';
export const SHOP_KEY = 'shop';
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
    /** The one-time «no longer supported» list was seen: forget it. */
    dismissUnsupportedProducts(): void {
      db.delete(appMeta).where(eq(appMeta.key, UNSUPPORTED_PRODUCTS_KEY)).run();
    },

    /** Cooking screen layout: step by step, or the whole recipe on one page. */
    setCookView(view: CookView): void {
      if (!COOK_VIEWS.includes(view)) throw new RangeError(`Unknown cook view ${view}`);
      setMeta(COOK_VIEW_KEY, view);
    },

    /** The shop the list is sorted for; null shows everything in one list. */
    setShop(shop: Shop | null): void {
      if (shop === null) {
        db.delete(appMeta).where(eq(appMeta.key, SHOP_KEY)).run();
        return;
      }
      if (!SHOPS.includes(shop)) throw new RangeError(`Unknown shop ${shop}`);
      setMeta(SHOP_KEY, shop);
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
