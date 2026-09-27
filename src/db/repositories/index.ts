import type { AppDb } from '../types';
import { createIngredientsRepo } from './ingredientsRepo';
import { createLogRepo } from './logRepo';
import { createPantryRepo } from './pantryRepo';
import { createPortionsRepo } from './portionsRepo';
import { createProfileRepo } from './profileRepo';
import { createRecipesRepo } from './recipesRepo';
import { createSettingsRepo } from './settingsRepo';
import { createShoppingRepo } from './shoppingRepo';

export function createRepositories(db: AppDb) {
  return {
    ingredients: createIngredientsRepo(db),
    recipes: createRecipesRepo(db),
    pantry: createPantryRepo(db),
    logs: createLogRepo(db),
    portions: createPortionsRepo(db),
    profile: createProfileRepo(db),
    settings: createSettingsRepo(db),
    shopping: createShoppingRepo(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
