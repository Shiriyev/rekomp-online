/** Screen «О данных»: where the catalog comes from and under which licenses. */
export const about = {
  intro:
    'Рецепты, продукты и их пищевая ценность собраны из открытых источников. Калории и белок посчитаны по данным USDA, а не взяты из рецептов.',
  sources: {
    mealdb: {
      title: 'TheMealDB',
      body: 'Рецепты и фото блюд. Тексты переведены и разбиты на шаги.',
    },
    usda: {
      title: 'USDA FoodData Central',
      body: 'Калорийность и БЖУ продуктов. Общественное достояние (CC0).',
    },
    pexels: {
      title: 'Pexels',
      body: 'Фото блюд и продуктов, лицензия Pexels.',
    },
  },
  open: 'Открыть сайт {{name}}',
  photographers_one: 'Авторы фото: {{count}}',
  photographers_few: 'Авторы фото: {{count}}',
  photographers_many: 'Авторы фото: {{count}}',
  photographers_other: 'Авторы фото: {{count}}',
  photoCount_one: '{{count}} фото',
  photoCount_few: '{{count}} фото',
  photoCount_many: '{{count}} фото',
  photoCount_other: '{{count}} фото',
} as const;
