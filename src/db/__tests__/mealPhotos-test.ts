/**
 * @jest-environment node
 *
 * FIXES v1.1 task 2: optional photo on manual entries; delete + Undo keeps it.
 */
import { ZodError } from 'zod';

import { createRepositories, type Repositories } from '../repositories';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;
const NOW = Date.UTC(2026, 8, 27, 10);
const PHOTO = 'file:///data/user/0/com.tmstart.rekomp/files/meal-photos/a.jpg';
const snack = { name: 'Сникерс', kcal: 250, protein: 4, mealType: 'snack' } as const;

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
});
afterEach(() => close());

describe('manual entry photo', () => {
  it('stores the photo URI, and works without one as before', () => {
    const withPhoto = repos.logs.addManual({ ...snack, photoUri: PHOTO }, NOW);
    const without = repos.logs.addManual(snack, NOW);
    expect(repos.logs.get(withPhoto.id)?.photoUri).toBe(PHOTO);
    expect(without.photoUri).toBeNull();
  });

  it('rejects an empty URI', () => {
    expect(() => repos.logs.addManual({ ...snack, photoUri: '' }, NOW)).toThrow(ZodError);
  });

  it('sets, replaces and clears a photo, returning the previous one', () => {
    const log = repos.logs.addManual(snack, NOW);
    expect(repos.logs.setPhoto(log.id, PHOTO)).toBeNull();
    expect(repos.logs.setPhoto(log.id, 'file:///x/b.jpg')).toBe(PHOTO);
    expect(repos.logs.setPhoto(log.id, null)).toBe('file:///x/b.jpg');
    expect(repos.logs.get(log.id)?.photoUri).toBeNull();
    expect(() => repos.logs.setPhoto('missing', PHOTO)).toThrow('Meal log not found');
  });

  it('lists referenced photos for the orphan sweep', () => {
    repos.logs.addManual({ ...snack, photoUri: PHOTO }, NOW);
    repos.logs.addManual({ ...snack, photoUri: PHOTO }, NOW);
    repos.logs.addManual(snack, NOW);
    expect(repos.logs.photoUris()).toEqual([PHOTO]);
    expect(repos.logs.isPhotoReferenced(PHOTO)).toBe(true);
    expect(repos.logs.isPhotoReferenced('file:///x/none.jpg')).toBe(false);
  });
});

describe('restore after delete (Undo)', () => {
  it('puts a deleted manual entry back with its photo, once', () => {
    const log = repos.logs.addManual({ ...snack, photoUri: PHOTO }, NOW);
    repos.logs.undo(log.id);
    expect(repos.logs.isPhotoReferenced(PHOTO)).toBe(false);

    repos.logs.restore(log);
    repos.logs.restore(log);
    expect(repos.logs.listByDate(log.localDate)).toEqual([log]);
    expect(repos.logs.isPhotoReferenced(PHOTO)).toBe(true);
  });

  it('takes the portion out of the fridge again for a portion entry', () => {
    const session = repos.cook.start('O1', 2, {}, NOW);
    const { portionId } = repos.cook.finish(session.id, { eatNow: false, mealType: 'lunch' }, NOW);
    const eaten = repos.portions.eat(portionId!, 'lunch', NOW);
    repos.logs.undo(eaten.id);
    expect(repos.portions.listAvailable()[0]?.portionsLeft).toBe(2);

    repos.logs.restore(eaten);
    expect(repos.portions.listAvailable()[0]?.portionsLeft).toBe(1);
    expect(repos.logs.get(eaten.id)).toEqual(eaten);
  });

  it('refuses when the portion is gone and changes nothing', () => {
    const session = repos.cook.start('O1', 1, {}, NOW);
    const { portionId } = repos.cook.finish(session.id, { eatNow: false, mealType: 'lunch' }, NOW);
    const eaten = repos.portions.eat(portionId!, 'lunch', NOW);
    repos.logs.undo(eaten.id);
    repos.portions.setPortionsLeft(portionId!, 0);

    expect(() => repos.logs.restore(eaten)).toThrow('no longer in the fridge');
    expect(repos.logs.get(eaten.id)).toBeUndefined();
  });
});

describe('photo cleanup bookkeeping', () => {
  it('remembers when the sweep last ran', () => {
    expect(repos.settings.getPhotoCleanupAt()).toBeNull();
    repos.settings.setPhotoCleanupAt(NOW);
    expect(repos.settings.getPhotoCleanupAt()).toBe(NOW);
  });
});
