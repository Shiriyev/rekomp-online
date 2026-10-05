/**
 * @jest-environment node
 *
 * PLAN phase 8 DoD: export → clear → import returns all data.
 */
import {
  backupFileName,
  BackupFormatError,
  exportBackup,
  importBackup,
  parseBackup,
  resetAllData,
} from '../backup';
import { runDataMigrations } from '../logicalDay';
import { createRepositories, type Repositories } from '../repositories';
import { applyBundledCatalog } from '../catalog/bundled';
import catalogJson from '../seed/catalog.v2.json';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;
const NOW = Date.UTC(2026, 8, 27, 10);

beforeEach(() => {
  ({ db, close } = createTestDb());
  // Same start-up sequence as DatabaseProvider.
  applyBundledCatalog(db);
  runDataMigrations(db);
  repos = createRepositories(db);
});
afterEach(() => close());

/** Touches every user table so the round trip covers all of them. */
function populate() {
  repos.profile.save(
    {
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
    },
    NOW,
  );
  repos.settings.setTheme('dark');
  repos.recipes.saveCustomAmounts('Z1', { tvorog: 200 });
  repos.recipes.toggleFavorite('Z1', NOW);
  repos.ingredients.updateSettings('tvorog', {
    kcalPer100g: 98,
    proteinPer100g: 18,
    gramsPerPiece: null,
    lowStockThreshold: 300,
  });
  const bar = repos.ingredients.createCustom({
    name: 'Батончик',
    category: 'dairy_eggs',
    unit: 'pcs',
    gramsPerPiece: 60,
    kcalPer100g: 350,
    proteinPer100g: 33,
  });
  repos.pantry.setQuantity(bar.id, 3, NOW);
  ['chicken_breast', 'rice', 'veg_frozen', 'oil'].forEach((id) =>
    repos.pantry.setQuantity(id, 1000, NOW),
  );
  const s = repos.cook.start('O1', 3, {}, NOW);
  repos.cook.finish(s.id, { eaten: 1, mealType: 'lunch' }, NOW);
  repos.recipes.hide('P4', NOW);
  const active = repos.cook.start('Z2', 1, { yogurt: 'greek_yogurt' }, NOW + 1);
  repos.cook.saveProgress(active.id, {
    stepIndex: 1,
    checked: ['1:egg'],
    timers: [
      { stepOrder: 1, durationSec: 540, startedAt: NOW, elapsedSec: 0, notificationId: null },
    ],
  });
  repos.logs.addManual({ name: 'Сникерс', kcal: 250, protein: 4.3, mealType: 'snack' }, NOW);
  repos.shopping.add({ title: 'Салфетки', ingredientId: null, quantity: null, unit: null }, NOW);
  repos.shopping.addMissing([{ ingredientId: 'egg', amount: 3, unit: 'pcs' }], NOW);
  repos.shopping.setChecked(
    repos.shopping.listOpen().find((i) => i.ingredientId === 'egg')!.id,
    true,
    NOW,
  );
}

const withoutTimestamp = <T extends { exportedAt: number }>(b: T) => ({ ...b, exportedAt: 0 });

describe('backup round trip', () => {
  it('export → reset → import restores every table exactly', () => {
    populate();
    const before = exportBackup(db, NOW);
    const file = JSON.stringify(before);

    resetAllData(db);
    expect(repos.profile.get()).toBeUndefined();
    expect(repos.pantry.list()).toEqual([]);
    expect(repos.logs.listByDate('2026-09-27')).toEqual([]);

    importBackup(db, parseBackup(JSON.parse(file)));
    expect(withoutTimestamp(exportBackup(db, NOW))).toEqual(withoutTimestamp(before));

    // Spot checks through the repositories.
    expect(repos.profile.get()?.weightKg).toBe(84.5);
    expect(repos.settings.getTheme()).toBe('dark');
    expect(repos.cook.getActive()?.progress?.checked).toEqual(['1:egg']);
    expect(repos.portions.listAvailable()[0]?.portionsLeft).toBe(2);
    expect(repos.ingredients.getById('tvorog')?.lowStockThreshold).toBe(300);
  });

  it('every table is part of the backup', () => {
    populate();
    const tables = exportBackup(db).tables;
    for (const [name, rows] of Object.entries(tables))
      expect([name, rows.length > 0]).toEqual([name, true]);
  });
});

describe('parseBackup', () => {
  it('rejects foreign files and newer formats', () => {
    expect(() => parseBackup({ foo: 1 })).toThrow(BackupFormatError);
    expect(() => parseBackup({ app: 'rekomp', formatVersion: 99, tables: {} })).toThrow(
      'errors.backup.newerVersion',
    );
    expect(() => parseBackup({ app: 'rekomp', formatVersion: 1 })).toThrow('errors.backup.noData');
  });

  it('rejects unknown columns, wrong types and missing required fields', () => {
    const base = exportBackup(db);
    const tweak = (fn: (b: typeof base) => void) => {
      const copy = JSON.parse(JSON.stringify(base)) as typeof base;
      fn(copy);
      return () => parseBackup(copy);
    };
    expect(tweak((b) => (b.tables.ingredients[0]!.hacked = 1))).toThrow('unknown field hacked');
    expect(tweak((b) => (b.tables.ingredients[0]!.kcalPer100g = 'много'))).toThrow(
      'number expected',
    );
    expect(tweak((b) => delete b.tables.ingredients[0]!.name)).toThrow('required field is empty');
    expect(tweak((b) => ((b.tables as Record<string, unknown>).recipes = 'x'))).toThrow(
      'list expected',
    );
  });

  it('treats missing tables as empty (older backups)', () => {
    const b = parseBackup({ app: 'rekomp', formatVersion: 1, exportedAt: 1, tables: {} });
    expect(b.tables.meal_logs).toEqual([]);
  });
});

describe('importBackup', () => {
  it('is all-or-nothing: a constraint violation leaves current data untouched', () => {
    populate();
    const good = exportBackup(db);
    const bad = JSON.parse(JSON.stringify(good)) as typeof good;
    bad.tables.pantry_items.push({ ingredientId: 'ghost', quantity: 1, unit: 'g', updatedAt: 0 });

    expect(() => importBackup(db, parseBackup(bad))).toThrow();
    expect(withoutTimestamp(exportBackup(db))).toEqual(withoutTimestamp(good));
  });

  it('applies the bundled catalog over an old backup (no catalog version in it)', () => {
    const empty = parseBackup({ app: 'rekomp', formatVersion: 1, exportedAt: 1, tables: {} });
    importBackup(db, empty);
    expect(repos.recipes.listDetails()).toHaveLength(catalogJson.recipes.length);
  });
});

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 8, 7))).toBe('rekomp-backup-2026-09-07.json');
  });
});
