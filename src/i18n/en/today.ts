import type { today as ru } from '../ru/today';
import type { Messages } from '../types';

export const today: Messages<typeof ru> = {
  continueCooking: 'Continue cooking',
  continueCookingHint: 'Back to the recipe steps',
  streak_one: 'Protein on track {{count}} day in a row',
  streak_few: 'Protein on track {{count}} days in a row',
  streak_many: 'Protein on track {{count}} days in a row',
  streak_other: 'Protein on track {{count}} days in a row',
  whatToCook: 'What to cook',
  fab: 'Add',
  fabA11y: 'Add manually',
  portionEaten: 'Portion eaten: {{name}}',
  summary: {
    kcalA11y: 'Calories: {{eaten}} of {{target}}',
    kcalOf: 'of {{target}} kcal',
    kcalOver: '{{kcal}} kcal over',
    kcalLeft: '{{kcal}} kcal left',
    proteinA11y: 'Protein: {{eaten}} of {{target}} grams',
    proteinOf: 'of {{target}} g protein',
    toMin: '{{grams}} g to minimum',
    toTarget: '{{grams}} g to goal',
    proteinDone: 'Protein done for today ✓',
  },
  grid: {
    kcalAbout: '~{{kcal}} kcal',
    kcalRange: '{{min}}–{{max}} kcal',
  },
  portions: {
    title: 'Ready in the fridge',
    eatHint: 'Eat one portion',
    a11y: '{{name}}, {{count}} left',
    meta: '{{kcal}} · {{protein}} g protein',
    eat: 'Eat a portion',
  },
  nudge: {
    title: 'Get ~{{grams}} g more protein',
    suggestion: '{{name}} · {{protein}} g',
  },
};
