import { addMeal } from './addMeal';
import { bulkAdd } from './bulkAdd';
import { common } from './common';
import { cooking } from './cooking';
import { recipes } from './recipes';
import { errors, validation } from './validation';

/** Every Russian message, by section. Each section lives in its own file. */
export const ru = { common, validation, errors, addMeal, bulkAdd, recipes, cooking };
