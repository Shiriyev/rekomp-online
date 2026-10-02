/** Profile → «Данные»: backup, restore, reset. Russian is the source of truth for keys. */
export const backup = {
  title: 'Данные',
  privacy:
    'Всё хранится только на телефоне. Бэкап — это файл с твоими данными (включая вес): храни его в надёжном месте.',
  noPhotos: 'Фото не входят в резервную копию.',
  export: 'Экспорт',
  import: 'Импорт',
  resetAll: 'Сбросить все данные',
  shareTitle: 'Бэкап «Рекомп»',
  unknownDate: 'неизвестно',
  importTitle: 'Восстановить из бэкапа?',
  importText: 'Бэкап от {{date}}, записей еды: {{entries}}. Все текущие данные будут заменены.',
  replace: 'Заменить',
  restored: 'Данные восстановлены',
  reset1Title: 'Сбросить все данные?',
  reset1Text:
    'Удалятся профиль, дневник, продукты, списки и каталог. Сначала можно сделать экспорт.',
  reset2Title: 'Точно удалить всё?',
  reset2Text: 'Это нельзя отменить.',
  no: 'Нет',
  deleteAll: 'Удалить всё',
} as const;
