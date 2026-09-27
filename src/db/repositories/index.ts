import type { AppDb } from '../types';
import { createCookRepo } from './cookRepo';
import { createIngredientsRepo } from './ingredientsRepo';
import { createLidlRepo } from './lidlRepo';
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
    cook: createCookRepo(db),
    portions: createPortionsRepo(db),
    profile: createProfileRepo(db),
    settings: createSettingsRepo(db),
    shopping: createShoppingRepo(db),
    lidl: createLidlRepo(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
