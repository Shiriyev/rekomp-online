/**
 * @jest-environment node
 *
 * FIXES_v2.1 task 3.4: «Скрыть это блюдо».
 */
import { createRepositories, type Repositories } from '../repositories';
import { hiddenRecipes } from '../schema';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;
beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
});
afterEach(() => close());

const hidden = () => db.select().from(hiddenRecipes).all();

it('hides a dish once and shows it again', () => {
  repos.recipes.hide('P4', 1);
  repos.recipes.hide('P4', 2);
  expect(hidden()).toEqual([{ recipeId: 'P4', hiddenAt: 1 }]);
  repos.recipes.unhide('P4');
  expect(hidden()).toEqual([]);
  repos.recipes.unhide('P4');
});

it('refuses an unknown dish', () => {
  expect(() => repos.recipes.hide('ghost')).toThrow();
});
