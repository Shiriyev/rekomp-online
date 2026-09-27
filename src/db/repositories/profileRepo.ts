import { eq } from 'drizzle-orm';

import { profile, type NewProfile, type Profile } from '../schema';
import type { AppDb } from '../types';

const PROFILE_ID = 1;

/** Single-row profile. Input validation lives with the onboarding form (phase 2). */
export function createProfileRepo(db: AppDb) {
  return {
    get(): Profile | undefined {
      return db.select().from(profile).where(eq(profile.id, PROFILE_ID)).get();
    },

    save(values: Omit<NewProfile, 'id' | 'updatedAt'>, now: number = Date.now()): Profile {
      const row = { ...values, id: PROFILE_ID, updatedAt: now };
      return db
        .insert(profile)
        .values(row)
        .onConflictDoUpdate({ target: profile.id, set: row })
        .returning()
        .get();
    },
  };
}

export type ProfileRepo = ReturnType<typeof createProfileRepo>;
