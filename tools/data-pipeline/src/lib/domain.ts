/**
 * The app's nutrition domain, reused as is (PHASE_2: no second implementation of the
 * macro maths). Pure TS with no React or DB imports, so it runs in Node.
 */
export {
  ingredientMacros,
  recipeMacros,
  roundKcal,
  roundProtein,
} from '../../../../src/domain/nutrition';
export { toGrams } from '../../../../src/domain/units';
export type { Macros, NutritionIngredient, RecipeLine, Unit } from '../../../../src/domain/types';
