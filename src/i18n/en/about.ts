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
    pexels: {
      title: 'Pexels',
      body: 'Dish and product photos, Pexels License.',
    },
  },
  open: 'Open the {{name}} website',
  photographers_one: '{{count}} photographer',
  photographers_few: '{{count}} photographers',
  photographers_many: '{{count}} photographers',
  photographers_other: '{{count}} photographers',
  photoCount_one: '{{count}} photo',
  photoCount_few: '{{count}} photos',
  photoCount_many: '{{count}} photos',
  photoCount_other: '{{count}} photos',
};
