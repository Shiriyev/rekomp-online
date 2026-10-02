import type { ru } from '../ru';
import type { Messages } from '../types';
import { about } from './about';
import { addMeal } from './addMeal';
import { backup } from './backup';
import { bulkAdd } from './bulkAdd';
import { common } from './common';
import { cooking } from './cooking';
import { history } from './history';
import { nav } from './nav';
import { onboarding } from './onboarding';
import { pantry } from './pantry';
import { profile } from './profile';
import { recipes } from './recipes';
import { today } from './today';
import { ui } from './ui';
import { errors, validation } from './validation';

export const en: Messages<typeof ru> = {
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
};
