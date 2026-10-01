/** Section «ui»: shared UI components. Russian is the source of truth for keys. */
export const ui = {
  stepper: {
    decrement: 'Меньше: {{label}}',
    increment: 'Больше: {{label}}',
  },
  photoViewer: {
    close: 'Закрыть фото',
  },
  database: {
    errorTitle: 'Не удалось открыть данные',
    errorDescription:
      'Перезапустите приложение. Если ошибка повторится — восстановите данные из бэкапа.',
  },
} as const;
