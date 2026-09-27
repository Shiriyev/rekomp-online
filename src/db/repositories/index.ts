import type { AppDb } from '../types';
import { createIngredientsRepo } from './ingredientsRepo';
import { createLogRepo } from './logRepo';
import { createPantryRepo } from './pantryRepo';
import { createProfileRepo } from './profileRepo';
import { createRecipesRepo } from './recipesRepo';

export function createRepositories(db: AppDb) {
  return {
    ingredients: createIngredientsRepo(db),
    recipes: createRecipesRepo(db),
    pantry: createPantryRepo(db),
    logs: createLogRepo(db),
    profile: createProfileRepo(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
