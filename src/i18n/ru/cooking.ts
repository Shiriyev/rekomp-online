/** Cooking mode: steps, timers, the one-page overview and the finish screen. */
export const cooking = {
  overview: {
    first: 'Сначала',
    middle: 'Затем',
    last: 'В конце',
    withDuration: '{{lead}} {{duration}}',
    fromMinute: ' (с {{minute}}-й мин)',
    seconds: '{{value}} сек',
    minutes: '{{value}} мин',
    total: 'По таймерам ≈ {{minutes}} мин (часть шагов можно делать параллельно).',
    toTaste: '{{name}} по вкусу',
    allDone: 'Всё готово',
  },
} as const;
