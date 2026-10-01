/** Form validation messages; schemas store the key, «|n» passes a number. */
export const validation = {
  required: 'Введите название',
  maxLength: 'Не длиннее {{n}} символов',
  integer: 'Нужно целое число',
  number: 'Введите число',
  min: 'Не меньше {{n}}',
  max: 'Не больше {{n}}',
  positive: 'Больше нуля',
  minAboveTarget: 'Минимум не может быть больше цели',
  pieceWeight: 'Укажите вес одной штуки',
  dateFormat: 'Дата в формате ГГГГ-ММ-ДД',
  chooseProduct: 'Выберите продукт',
  barcode: '8–14 цифр',
  quantityWithUnit: 'Количество и единица указываются вместе',
  chooseSex: 'Выберите пол',
  chooseActivity: 'Выберите активность',
  timeFormat: 'Время в формате ЧЧ:ММ, например 08:30',
  futureTime: 'Время не может быть в будущем',
} as const;

export const errors = {
  duplicateBarcode: 'Товар с таким штрихкодом уже есть',
  backup: {
    notBackup: 'Это не файл бэкапа «Рекомп»',
    newerVersion: 'Бэкап из более новой версии приложения — обнови приложение',
    noData: 'В файле нет данных',
    corrupt: 'Файл бэкапа повреждён ({{n}})',
    notJson: 'Файл не читается как JSON',
    shareUnavailable: 'Отправка файлов недоступна на этом устройстве',
  },
} as const;
