import { eq } from 'drizzle-orm';

import { toLocalDate } from '../../domain/dates';
import { profileSchema, type ProfileInput } from '../../domain/schemas';
import { profile, weightLogs, type Profile } from '../schema';
import type { AppDb } from '../types';

const PROFILE_ID = 1;

/** Single-row profile. Every save also records the day's weight for the history chart. */
export function createProfileRepo(db: AppDb) {
  return {
    get(): Profile | undefined {
      return db.select().from(profile).where(eq(profile.id, PROFILE_ID)).get();
    },

    save(input: ProfileInput, now: number = Date.now()): Profile {
      const values = profileSchema.parse(input);
      const row = { ...values, id: PROFILE_ID, updatedAt: now };
      const weight = { localDate: toLocalDate(now), weightKg: values.weightKg };

      return db.transaction((tx) => {
        tx.insert(weightLogs)
          .values(weight)
          .onConflictDoUpdate({ target: weightLogs.localDate, set: weight })
          .run();
        return tx
          .insert(profile)
          .values(row)
          .onConflictDoUpdate({ target: profile.id, set: row })
          .returning()
          .get();
      });
    },
  };
}

export type ProfileRepo = ReturnType<typeof createProfileRepo>;
