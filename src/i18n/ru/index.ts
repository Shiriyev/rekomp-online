import { about } from './about';
import { addMeal } from './addMeal';
import { backup } from './backup';
import { bulkAdd } from './bulkAdd';
import { catalog } from './catalog';
import { common } from './common';
import { cooking } from './cooking';
import { history } from './history';
import { nav } from './nav';
import { onboarding } from './onboarding';
import { pantry } from './pantry';
import { products } from './products';
import { profile } from './profile';
import { recipes } from './recipes';
import { today } from './today';
import { ui } from './ui';
import { errors, validation } from './validation';

/** Every Russian message, by section. Each section lives in its own file. */
export const ru = {
  common,
  validation,
  errors,
  addMeal,
  bulkAdd,
  recipes,
  cooking,
  nav,
  today,
  ui,
  history,
  pantry,
  profile,
  onboarding,
  backup,
  about,
  catalog,
  products,
};
