/** Section «today»: the Today screen and its cards. Russian is the source of truth for keys. */
export const today = {
  continueCooking: 'Продолжить готовку',
  continueCookingHint: 'Вернуться к шагам рецепта',
  streak_one: 'Белок в норме {{count}} день подряд',
  streak_few: 'Белок в норме {{count}} дня подряд',
  streak_many: 'Белок в норме {{count}} дней подряд',
  streak_other: 'Белок в норме {{count}} дня подряд',
  whatToCook: 'Что приготовить',
  fab: 'Добавить',
  fabA11y: 'Добавить вручную',
  portionEaten: 'Съедена порция: {{name}}',
  summary: {
    kcalA11y: 'Калории: {{eaten}} из {{target}}',
    kcalOf: 'из {{target}} ккал',
    kcalOver: 'Перебор {{kcal}} ккал',
    kcalLeft: 'Осталось {{kcal}} ккал',
    proteinA11y: 'Белок: {{eaten}} из {{target}} грамм',
    proteinOf: 'из {{target}} г белка',
    toMin: 'До минимума {{grams}} г',
    toTarget: 'До цели {{grams}} г',
    proteinDone: 'Белок на сегодня есть ✓',
  },
  grid: {
    kcalAbout: '~{{kcal}} ккал',
    kcalRange: '{{min}}–{{max}} ккал',
  },
  portions: {
    title: 'Готово в холодильнике',
    eatHint: 'Съесть одну порцию',
    a11y: '{{name}}, осталось {{count}}',
    meta: '{{kcal}} · {{protein}} г белка',
    eat: 'Съесть порцию',
  },
  nudge: {
    title: 'Добери ~{{grams}} г белка',
    suggestion: '{{name}} · {{protein}} г',
  },
} as const;
