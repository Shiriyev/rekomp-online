import type { about as ru } from '../ru/about';
import type { Messages } from '../types';

export const about: Messages<typeof ru> = {
  intro:
    'Recipes, products and their nutrition come from open sources. Calories and protein are computed from USDA data, not taken from the recipes.',
  sources: {
    mealdb: {
      title: 'TheMealDB',
      body: 'Recipes and dish photos. The texts were translated and split into steps.',
    },
    usda: {
      title: 'USDA FoodData Central',
      body: 'Calories and macros of products. Public domain (CC0).',
    },
    off: {
      title: 'Open Food Facts',
      body: 'Store products: database under ODbL, photos under CC BY-SA.',
    },
    pexels: {
      title: 'Pexels',
      body: 'Product photos, Pexels License. Photographers: {{count}}.',
    },
  },
  open: 'Open the {{name}} website',
  footer: 'The full list of authors is in ATTRIBUTION.md in the app repository.',
};
