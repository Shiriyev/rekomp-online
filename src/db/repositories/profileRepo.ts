import { eq } from 'drizzle-orm';

import { isValidDayStartHour } from '../../domain/day';
import { profileSchema, type ProfileInput } from '../../domain/schemas';
import { logicalDateAt, recomputeLocalDates } from '../logicalDay';
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

      return db.transaction((tx) => {
        const weight = { localDate: logicalDateAt(tx, now), weightKg: values.weightKg };
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

    /**
     * Changes when the logical day starts and re-files every meal entry under the new rule,
     * in one transaction. Returns how many entries moved to another day.
     */
    setDayStartHour(hour: number, now: number = Date.now()): number {
      if (!isValidDayStartHour(hour)) {
        throw new RangeError(`dayStartHour must be an integer 0–6, got ${hour}`);
      }
      return db.transaction((tx) => {
        const updated = tx
          .update(profile)
          .set({ dayStartHour: hour, updatedAt: now })
          .where(eq(profile.id, PROFILE_ID))
          .returning({ id: profile.id })
          .all();
        if (updated.length === 0) throw new Error('Profile not found');
        return recomputeLocalDates(tx, hour);
      });
    },
  };
}

export type ProfileRepo = ReturnType<typeof createProfileRepo>;
