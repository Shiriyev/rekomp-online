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
    off: {
      title: 'Open Food Facts',
      body: 'Товары из магазинов: база данных — ODbL, фото — CC BY-SA.',
    },
    pexels: {
      title: 'Pexels',
      body: 'Фото продуктов, лицензия Pexels. Авторов фото: {{count}}.',
    },
  },
  open: 'Открыть сайт {{name}}',
  footer: 'Полный список авторов — в файле ATTRIBUTION.md в репозитории приложения.',
} as const;
