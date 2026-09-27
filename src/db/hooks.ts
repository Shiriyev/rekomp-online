import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { themePreferenceSchema, type ThemePreference } from '@/domain/schemas';

import { db } from './client';
import { THEME_KEY } from './repositories/settingsRepo';
import { appMeta, profile, type Profile } from './schema';

/** Reactive profile row. `isLoaded` is false until the first query resolves. */
export function useProfile(): { profile: Profile | undefined; isLoaded: boolean } {
  const { data, updatedAt } = useLiveQuery(db.select().from(profile).limit(1));
  return { profile: data[0], isLoaded: updatedAt !== undefined };
}

export function useThemePreference(): ThemePreference {
  const { data } = useLiveQuery(db.select().from(appMeta).where(eq(appMeta.key, THEME_KEY)));
  const parsed = themePreferenceSchema.safeParse(data[0]?.value);
  return parsed.success ? parsed.data : 'system';
}
