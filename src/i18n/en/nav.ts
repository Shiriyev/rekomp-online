import type { nav as ru } from '../ru/nav';
import type { Messages } from '../types';

export const nav: Messages<typeof ru> = {
  tabs: {
    today: 'Today',
    pantry: 'Food',
    history: 'History',
    profile: 'Profile',
  },
  headers: {
    editProfile: 'Details and goals',
    recipes: 'Dishes',
    recipe: 'Dish',
    logEntry: 'Entry',
    bulkAdd: 'Add to home',
    bulkAmounts: 'Amounts',
    aboutData: 'About the data',
  },
};
