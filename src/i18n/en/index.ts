import type { Messages } from '../types';
import type { ru } from '../ru';
import { addMeal } from './addMeal';
import { bulkAdd } from './bulkAdd';
import { common } from './common';
import { cooking } from './cooking';
import { recipes } from './recipes';
import { errors, validation } from './validation';

export const en: Messages<typeof ru> = {
  common,
  validation,
  errors,
  addMeal,
  bulkAdd,
  recipes,
  cooking,
};
