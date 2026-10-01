/**
 * @jest-environment node
 *
 * FIXES v1.1 task 1: the day ends at 04:00 (configurable), and existing entries are re-filed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { exportBackup, importBackup } from '../backup';
import { LOGICAL_DAY_MIGRATION_KEY, recomputeLocalDates, runDataMigrations } from '../logicalDay';
import { createRepositories, type Repositories } from '../repositories';
import * as schema from '../schema';
import { appMeta, mealLogs, profile, weightLogs } from '../schema';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;

/** Wall-clock time in Budapest (tests run with TZ=Europe/Budapest). */
const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

const PROFILE = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 84.5,
  activityLevel: 'moderate',
  goalRateKgPerWeek: -0.5,
  kcalTarget: 2150,
  proteinTargetG: 140,
  proteinMinG: 120,
  targetOverridden: true,
} as const;

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
  repos.profile.save(PROFILE, local(2026, 9, 1, 12));
});
afterEach(() => close());

const snack = { name: 'Сникерс', kcal: 250, protein: 4, mealType: 'snack' } as const;

describe('new entries use the logical day', () => {
  it('defaults to a 04:00 day start', () => {
    expect(repos.profile.get()?.dayStartHour).toBe(4);
  });

  it('files a manual entry at 01:00 under yesterday and one at 04:10 under today', () => {
    const late = repos.logs.addManual(snack, local(2026, 10, 1, 1, 0));
    const early = repos.logs.addManual(snack, local(2026, 10, 1, 4, 10));
    expect(late.localDate).toBe('2026-09-30');
    expect(early.localDate).toBe('2026-10-01');
    expect(repos.logs.dayTotals('2026-09-30').kcal).toBe(250);
  });

  it('applies to cooking and fridge portions too', () => {
    const cooked = repos.cook.quickEat('P4', 1, {}, 'snack', local(2026, 10, 1, 0, 30));
    expect(repos.logs.get(cooked.logId!)?.localDate).toBe('2026-09-30');

    const session = repos.cook.start('O1', 3, {}, local(2026, 9, 30, 18));
    const finished = repos.cook.finish(
      session.id,
      { eatNow: false, mealType: 'lunch' },
      local(2026, 9, 30, 19),
    );
    const eaten = repos.portions.eat(finished.portionId!, 'snack', local(2026, 10, 1, 2, 0));
    expect(eaten.localDate).toBe('2026-09-30');
  });

  it('records the weight under the logical day', () => {
    repos.profile.save({ ...PROFILE, weightKg: 84 }, local(2026, 10, 2, 1, 0));
    const row = db.select().from(weightLogs).where(eq(weightLogs.localDate, '2026-10-01')).get();
    expect(row?.weightKg).toBe(84);
  });
});

describe('setDayStartHour', () => {
  it('re-files every entry in one go and reports how many moved', () => {
    const late = repos.logs.addManual(snack, local(2026, 10, 1, 1, 0));
    const noon = repos.logs.addManual(snack, local(2026, 10, 1, 12, 0));

    expect(repos.profile.setDayStartHour(0)).toBe(1);
    expect(repos.profile.get()?.dayStartHour).toBe(0);
    expect(repos.logs.get(late.id)?.localDate).toBe('2026-10-01');
    expect(repos.logs.get(noon.id)?.localDate).toBe('2026-10-01');

    // New entries follow the new rule; going back moves the late one again.
    expect(repos.logs.addManual(snack, local(2026, 10, 2, 1, 0)).localDate).toBe('2026-10-02');
    expect(repos.profile.setDayStartHour(4)).toBe(2);
    expect(repos.logs.get(late.id)?.localDate).toBe('2026-09-30');
  });

  it('rejects hours outside 0–6 without touching anything', () => {
    const late = repos.logs.addManual(snack, local(2026, 10, 1, 1, 0));
    expect(() => repos.profile.setDayStartHour(7)).toThrow(RangeError);
    expect(() => repos.profile.setDayStartHour(2.5)).toThrow(RangeError);
    expect(repos.profile.get()?.dayStartHour).toBe(4);
    expect(repos.logs.get(late.id)?.localDate).toBe('2026-09-30');
  });

  it('is enforced by the database as well', () => {
    expect(() => db.update(profile).set({ dayStartHour: 9 }).run()).toThrow(/CHECK/);
  });

  it('fails without a profile and leaves entries alone', () => {
    const late = repos.logs.addManual(snack, local(2026, 10, 1, 1, 0));
    db.delete(profile).run();
    expect(() => repos.profile.setDayStartHour(0)).toThrow('Profile not found');
    expect(repos.logs.get(late.id)?.localDate).toBe('2026-09-30');
  });
});

/** A v1 entry: localDate was the calendar day of the timestamp. */
function insertV1Log(id: string, timestamp: number, localDate: string) {
  db.insert(mealLogs)
    .values({
      id,
      timestamp,
      localDate,
      mealType: 'snack',
      source: 'manual',
      name: id,
      kcal: 100,
      protein: 1,
    })
    .run();
}

describe('runDataMigrations', () => {
  it('re-files v1 entries once and is idempotent', () => {
    insertV1Log('late', local(2026, 10, 1, 0, 30), '2026-10-01');
    insertV1Log('day', local(2026, 10, 1, 9, 0), '2026-10-01');

    expect(runDataMigrations(db)).toBe(1);
    expect(repos.logs.get('late')?.localDate).toBe('2026-09-30');
    expect(repos.logs.get('day')?.localDate).toBe('2026-10-01');
    expect(
      db.select().from(appMeta).where(eq(appMeta.key, LOGICAL_DAY_MIGRATION_KEY)).get(),
    ).toBeDefined();

    // Second start: marker present, nothing runs; a plain recompute changes nothing either.
    expect(runDataMigrations(db)).toBeNull();
    expect(recomputeLocalDates(db, 4)).toBe(0);
  });

  it('works before onboarding (no profile, default 04:00)', () => {
    db.delete(profile).run();
    insertV1Log('late', local(2026, 10, 1, 3, 59), '2026-10-01');
    expect(runDataMigrations(db)).toBe(1);
    expect(repos.logs.get('late')?.localDate).toBe('2026-09-30');
  });
});

describe('backup import', () => {
  it('re-files entries of a v1 backup (no dayStartHour, calendar days)', () => {
    insertV1Log('late', local(2026, 10, 1, 1, 0), '2026-10-01');
    const backup = exportBackup(db);
    // A v1 profile row has no dayStartHour column.
    const { dayStartHour: _omit, ...v1Profile } = backup.tables.profile[0] as Record<
      string,
      unknown
    >;
    backup.tables.profile = [v1Profile];
    backup.tables.meal_logs = backup.tables.meal_logs.map((r) => ({
      ...r,
      localDate: '2026-10-01',
    }));

    importBackup(db, backup);
    expect(repos.profile.get()?.dayStartHour).toBe(4);
    expect(repos.logs.get('late')?.localDate).toBe('2026-09-30');
    expect(runDataMigrations(db)).toBeNull();
  });
});

describe('SQL migration 0005 on a v1 database', () => {
  it('adds dayStartHour without losing profile data', () => {
    const source = path.join(__dirname, '..', 'migrations');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rekomp-v1-'));
    const v1 = fs.mkdtempSync(path.join(os.tmpdir(), 'rekomp-v1-mig-'));
    try {
      // Migrations as shipped in v1 (0000–0004).
      const journal = JSON.parse(fs.readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
      const v1Entries = journal.entries.filter((e: { idx: number }) => e.idx <= 4);
      fs.mkdirSync(path.join(v1, 'meta'));
      fs.writeFileSync(
        path.join(v1, 'meta/_journal.json'),
        JSON.stringify({ ...journal, entries: v1Entries }),
      );
      for (const e of v1Entries) {
        fs.copyFileSync(path.join(source, `${e.tag}.sql`), path.join(v1, `${e.tag}.sql`));
      }

      const sqlite = new Database(path.join(tmp, 'v1.db'));
      sqlite.pragma('foreign_keys = ON');
      const old = drizzle(sqlite, { schema });
      migrate(old, { migrationsFolder: v1 });
      sqlite
        .prepare(
          `INSERT INTO profile (id, sex, age, height_cm, weight_kg, activity_level, goal_rate_kg_per_week,
             kcal_target, protein_target_g, protein_min_g, target_overridden, updated_at)
           VALUES (1, 'male', 30, 180, 84.5, 'moderate', -0.5, 2150, 140, 120, 1, 1)`,
        )
        .run();
      sqlite
        .prepare(
          `INSERT INTO meal_logs (id, timestamp, local_date, meal_type, source, name, kcal, protein)
           VALUES ('late', ?, '2026-10-01', 'snack', 'manual', 'Сникерс', 250, 4)`,
        )
        .run(local(2026, 10, 1, 0, 30));

      migrate(old, { migrationsFolder: source });
      const migrated = old as unknown as AppDb;
      expect(migrated.select().from(profile).get()).toMatchObject({
        weightKg: 84.5,
        kcalTarget: 2150,
        targetOverridden: true,
        dayStartHour: 4,
      });
      expect(runDataMigrations(migrated)).toBe(1);
      expect(migrated.select().from(mealLogs).get()?.localDate).toBe('2026-09-30');
      sqlite.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(v1, { recursive: true, force: true });
    }
  });
});
