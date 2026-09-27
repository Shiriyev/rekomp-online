import type { MealType, Unit } from '../../domain/types';

/** One ingredient line; `unit` defaults to the ingredient's own unit. Amounts are per serving. */
export type SeedLine = {
  id: string;
  amount: number;
  unit?: Unit;
  /** Lines sharing a group are interchangeable; the first one listed is the default. */
  alt?: string;
  optional?: boolean;
  note?: string;
};

export type SeedStep = { text: string; timerMin?: number; refs?: string[] };

export type SeedRecipe = {
  id: string;
  name: string;
  mealType: MealType;
  totalMinutes: number;
  prepNightBefore?: boolean;
  tags?: string[];
  lines: SeedLine[];
  steps: SeedStep[];
};

/** Recipe content from PLAN §6.2. Lunches are batch-cooked (see LUNCH_DEFAULTS in runSeed). */
export const SEED_RECIPES: SeedRecipe[] = [
  // ---------- Breakfast ----------
  {
    id: 'Z1',
    name: 'Творог с ягодами и овсянкой',
    mealType: 'breakfast',
    totalMinutes: 5,
    prepNightBefore: true,
    tags: ['с вечера'],
    lines: [
      { id: 'tvorog', amount: 250 },
      { id: 'berries_frozen', amount: 100 },
      { id: 'oats', amount: 40 },
      { id: 'banana', amount: 1 },
    ],
    steps: [
      {
        text: 'Вечером: творог в контейнер, сверху ягоды, закрыть и убрать в холодильник.',
        refs: ['tvorog', 'berries_frozen'],
      },
      { text: 'Утром: добавить овсянку и перемешать.', refs: ['oats'] },
      { text: 'Нарезать банан сверху.', refs: ['banana'] },
    ],
  },
  {
    id: 'Z2',
    name: 'Овсянка со скиром и яйцами',
    mealType: 'breakfast',
    totalMinutes: 15,
    lines: [
      { id: 'oats', amount: 60 },
      { id: 'skyr', amount: 150, alt: 'yogurt' },
      { id: 'greek_yogurt', amount: 150, alt: 'yogurt' },
      { id: 'berries_frozen', amount: 100 },
      { id: 'egg', amount: 2 },
    ],
    steps: [
      { text: 'Яйца опустить в кипящую воду.', timerMin: 9, refs: ['egg'] },
      { text: 'Овсянку залить ~120 мл кипятка и накрыть.', timerMin: 5, refs: ['oats'] },
      { text: 'Яйца переложить в холодную воду и очистить.', refs: ['egg'] },
      {
        text: 'К овсянке добавить скир и ягоды.',
        refs: ['skyr', 'greek_yogurt', 'berries_frozen'],
      },
    ],
  },
  {
    id: 'Z3',
    name: 'Яйца с творогом и хлебом',
    mealType: 'breakfast',
    totalMinutes: 12,
    lines: [
      { id: 'egg', amount: 3 },
      { id: 'tvorog', amount: 100 },
      { id: 'bread_wholegrain', amount: 2 },
      { id: 'cucumber', amount: 100, alt: 'fresh_veg' },
      { id: 'tomato', amount: 100, alt: 'fresh_veg' },
    ],
    steps: [
      { text: 'Разогреть антипригарную сковороду.', timerMin: 1 },
      { text: 'Вбить яйца и жарить под крышкой.', timerMin: 5, refs: ['egg'] },
      { text: 'Нарезать овощи.', refs: ['cucumber', 'tomato'] },
      { text: 'Подать с творогом и хлебом.', refs: ['tvorog', 'bread_wholegrain'] },
    ],
  },
  {
    id: 'Z4',
    name: 'Йогурт с творогом и мюсли',
    mealType: 'breakfast',
    totalMinutes: 5,
    tags: ['без готовки'],
    lines: [
      { id: 'yogurt_01', amount: 350, note: '2 стакана' },
      { id: 'tvorog', amount: 150 },
      { id: 'muesli', amount: 40 },
      { id: 'banana', amount: 1 },
    ],
    steps: [
      { text: 'Йогурт и творог выложить в миску и перемешать.', refs: ['yogurt_01', 'tvorog'] },
      { text: 'Посыпать мюсли сверху.', refs: ['muesli'] },
      { text: 'Нарезать банан.', refs: ['banana'] },
    ],
  },

  // ---------- Lunch (batch) ----------
  {
    id: 'O1',
    name: 'Курица с рисом и овощами (как плов)',
    mealType: 'lunch',
    totalMinutes: 45,
    tags: ['на 3 дня'],
    lines: [
      { id: 'chicken_breast', amount: 220 },
      { id: 'rice', amount: 100 },
      { id: 'veg_frozen', amount: 150 },
      { id: 'oil', amount: 5, note: '1 ч.л.' },
      { id: 'cumin', amount: 0, note: 'по вкусу' },
      { id: 'salt', amount: 0, note: 'по вкусу' },
      { id: 'pepper', amount: 0, note: 'по вкусу' },
    ],
    steps: [
      { text: 'Нарезать курицу кубиками 2–3 см.', refs: ['chicken_breast'] },
      { text: 'Масло в кастрюлю, обжарить курицу.', timerMin: 6, refs: ['oil', 'chicken_breast'] },
      { text: 'Добавить овощи.', timerMin: 3, refs: ['veg_frozen'] },
      {
        text: 'Добавить промытый рис, воду (×2 от объёма риса) и специи.',
        refs: ['rice', 'cumin', 'salt', 'pepper'],
      },
      { text: 'Довести до кипения, накрыть крышкой, минимальный огонь.', timerMin: 20 },
      { text: 'Дать постоять, перемешать и разложить по контейнерам.', timerMin: 5 },
    ],
  },
  {
    id: 'O2',
    name: 'Чечевица с курицей и томатами',
    mealType: 'lunch',
    totalMinutes: 50,
    tags: ['на 3 дня'],
    lines: [
      { id: 'chicken_breast', amount: 150 },
      { id: 'lentils_green', amount: 80 },
      { id: 'passata', amount: 200, alt: 'tomato_base' },
      { id: 'tomatoes_canned', amount: 200, alt: 'tomato_base' },
      { id: 'onion', amount: 0.5 },
      { id: 'oil', amount: 5, note: '1 ч.л.' },
      { id: 'bread_wholegrain', amount: 1, note: 'при подаче' },
      { id: 'salt', amount: 0, note: 'по вкусу' },
    ],
    steps: [
      { text: 'Промыть чечевицу.', refs: ['lentils_green'] },
      { text: 'Нарезать лук и курицу.', refs: ['onion', 'chicken_breast'] },
      {
        text: 'Масло, обжарить лук и курицу.',
        timerMin: 5,
        refs: ['oil', 'onion', 'chicken_breast'],
      },
      {
        text: 'Добавить чечевицу, томаты и воду (покрыть на 2–3 см), посолить.',
        refs: ['lentils_green', 'passata', 'tomatoes_canned', 'salt'],
      },
      {
        text: 'Варить под крышкой, помешивая. Проверить мягкость, при необходимости ещё 5 мин.',
        timerMin: 30,
      },
      { text: 'Разложить по контейнерам; хлеб — при подаче.', refs: ['bread_wholegrain'] },
    ],
  },
  {
    id: 'O3',
    name: 'Пенне с фаршем индейки',
    mealType: 'lunch',
    totalMinutes: 35,
    tags: ['на 3 дня'],
    lines: [
      { id: 'turkey_mince', amount: 200 },
      { id: 'penne', amount: 90 },
      { id: 'passata', amount: 150 },
      { id: 'veg_frozen', amount: 100 },
      { id: 'oil', amount: 5, note: '1 ч.л.' },
    ],
    steps: [
      { text: 'Поставить воду для пенне.' },
      {
        text: 'Масло, обжарить фарш, разбивая комочки.',
        timerMin: 7,
        refs: ['oil', 'turkey_mince'],
      },
      { text: 'Добавить пассату и овощи, тушить.', timerMin: 10, refs: ['passata', 'veg_frozen'] },
      { text: 'Параллельно сварить пенне по упаковке.', timerMin: 10, refs: ['penne'] },
      { text: 'Слить пенне, смешать с соусом в кастрюле и разложить.' },
    ],
  },
  {
    id: 'O4',
    name: 'Курица по-венгерски с картошкой',
    mealType: 'lunch',
    totalMinutes: 45,
    tags: ['на 3 дня'],
    lines: [
      { id: 'chicken_breast', amount: 220 },
      { id: 'potato', amount: 300 },
      { id: 'onion', amount: 0.5 },
      { id: 'bell_pepper', amount: 0.5 },
      { id: 'tomatoes_canned', amount: 100 },
      { id: 'oil', amount: 5, note: '1 ч.л.' },
      { id: 'paprika_powder', amount: 0, note: 'по вкусу' },
      { id: 'salt', amount: 0, note: 'по вкусу' },
    ],
    steps: [
      {
        text: 'Нарезать лук, паприку, курицу и картофель кубиками 2 см.',
        refs: ['onion', 'bell_pepper', 'chicken_breast', 'potato'],
      },
      {
        text: 'Масло, обжарить лук и паприку.',
        timerMin: 3,
        refs: ['oil', 'onion', 'bell_pepper'],
      },
      { text: 'Добавить курицу.', timerMin: 5, refs: ['chicken_breast'] },
      {
        text: 'Добавить картофель, томаты, ~100 мл воды и специи.',
        refs: ['potato', 'tomatoes_canned', 'paprika_powder', 'salt'],
      },
      { text: 'Тушить под крышкой, проверить картофель вилкой.', timerMin: 25 },
    ],
  },

  // ---------- Snack ----------
  {
    id: 'P1',
    name: 'Скир + яблоко',
    mealType: 'snack',
    totalMinutes: 2,
    tags: ['без готовки'],
    lines: [
      { id: 'skyr', amount: 150, alt: 'yogurt' },
      { id: 'greek_yogurt', amount: 150, alt: 'yogurt' },
      { id: 'apple', amount: 1 },
    ],
    steps: [{ text: 'Подать скир с яблоком.', refs: ['skyr', 'greek_yogurt', 'apple'] }],
  },
  {
    id: 'P2',
    name: 'Творог с ягодами',
    mealType: 'snack',
    totalMinutes: 3,
    prepNightBefore: true,
    tags: ['с вечера'],
    lines: [
      { id: 'tvorog', amount: 150 },
      { id: 'berries_frozen', amount: 50 },
    ],
    steps: [
      { text: 'Вечером: ягоды на творог и в холодильник.', refs: ['tvorog', 'berries_frozen'] },
      { text: 'Съесть.' },
    ],
  },
  {
    id: 'P3',
    name: 'Яйца и овощи',
    mealType: 'snack',
    totalMinutes: 12,
    lines: [
      { id: 'egg', amount: 2 },
      { id: 'cucumber', amount: 100, alt: 'fresh_veg' },
      { id: 'tomato', amount: 100, alt: 'fresh_veg' },
    ],
    steps: [
      { text: 'Сварить яйца (или взять сваренные заранее).', timerMin: 9, refs: ['egg'] },
      { text: 'Нарезать овощи.', refs: ['cucumber', 'tomato'] },
    ],
  },
  {
    id: 'P4',
    name: 'Йогурт + банан',
    mealType: 'snack',
    totalMinutes: 2,
    tags: ['без готовки'],
    lines: [
      { id: 'yogurt_01', amount: 175 },
      { id: 'banana', amount: 1 },
    ],
    steps: [{ text: 'Подать йогурт с бананом.', refs: ['yogurt_01', 'banana'] }],
  },

  // ---------- Dinner ----------
  {
    id: 'U1',
    name: 'Омлет с овощами и сыром',
    mealType: 'dinner',
    totalMinutes: 15,
    lines: [
      { id: 'egg', amount: 3 },
      { id: 'veg_frozen', amount: 150 },
      { id: 'cheese', amount: 20 },
      { id: 'bread_wholegrain', amount: 2 },
      { id: 'oil', amount: 5, note: '1 ч.л.' },
      { id: 'salt', amount: 0, note: 'по вкусу' },
    ],
    steps: [
      { text: 'Взбить яйца с солью.', refs: ['egg', 'salt'] },
      { text: 'Масло, выложить овощи на сковороду.', timerMin: 3, refs: ['oil', 'veg_frozen'] },
      {
        text: 'Залить яйцами, сыр сверху, накрыть крышкой, средний огонь.',
        timerMin: 7,
        refs: ['cheese'],
      },
      { text: 'Подать с хлебом.', refs: ['bread_wholegrain'] },
    ],
  },
  {
    id: 'U2',
    name: 'Пенне с тунцом',
    mealType: 'dinner',
    totalMinutes: 20,
    lines: [
      { id: 'tuna_water', amount: 1, note: '1 банка' },
      { id: 'penne', amount: 70 },
      { id: 'tomatoes_canned', amount: 150, alt: 'sauce_base' },
      { id: 'veg_frozen', amount: 150, alt: 'sauce_base' },
      { id: 'oil', amount: 5, note: '1 ч.л.' },
    ],
    steps: [
      { text: 'Сварить пенне.', timerMin: 10, refs: ['penne'] },
      {
        text: 'Масло, прогреть томаты или овощи.',
        timerMin: 5,
        refs: ['oil', 'tomatoes_canned', 'veg_frozen'],
      },
      { text: 'Слить тунец.', refs: ['tuna_water'] },
      { text: 'Смешать всё.' },
    ],
  },
  {
    id: 'U3',
    name: 'Салат с тунцом и яйцами',
    mealType: 'dinner',
    totalMinutes: 15,
    lines: [
      { id: 'tuna_water', amount: 1, note: '1 банка' },
      { id: 'egg', amount: 2 },
      { id: 'cucumber', amount: 100 },
      { id: 'tomato', amount: 100 },
      { id: 'bread_wholegrain', amount: 2 },
    ],
    steps: [
      { text: 'Сварить яйца (или взять готовые).', timerMin: 9, refs: ['egg'] },
      { text: 'Нарезать овощи и яйца.', refs: ['cucumber', 'tomato', 'egg'] },
      { text: 'Смешать с тунцом, подать с хлебом.', refs: ['tuna_water', 'bread_wholegrain'] },
    ],
  },
  {
    id: 'U4',
    name: 'Шакшука',
    mealType: 'dinner',
    totalMinutes: 25,
    lines: [
      { id: 'egg', amount: 3 },
      { id: 'tomatoes_canned', amount: 200 },
      { id: 'onion', amount: 0.5 },
      { id: 'bell_pepper', amount: 0.5 },
      { id: 'bread_wholegrain', amount: 1 },
      { id: 'oil', amount: 5, note: '1 ч.л.' },
    ],
    steps: [
      { text: 'Нарезать лук и паприку.', refs: ['onion', 'bell_pepper'] },
      { text: 'Масло, обжарить лук и паприку.', timerMin: 3, refs: ['oil'] },
      { text: 'Добавить томаты.', timerMin: 5, refs: ['tomatoes_canned'] },
      { text: 'Сделать 3 углубления и вбить яйца.', refs: ['egg'] },
      { text: 'Накрыть крышкой.', timerMin: 6 },
      { text: 'Подать с хлебом.', refs: ['bread_wholegrain'] },
    ],
  },
];
