import type { errors as ruErrors, validation as ruValidation } from '../ru/validation';
import type { Messages } from '../types';

export const validation: Messages<typeof ruValidation> = {
  required: 'Enter a name',
  maxLength: 'At most {{n}} characters',
  integer: 'Whole number needed',
  number: 'Enter a number',
  min: 'At least {{n}}',
  max: 'At most {{n}}',
  positive: 'Must be more than zero',
  minAboveTarget: 'Minimum cannot be above the target',
  pieceWeight: 'Enter the weight of one piece',
  dateFormat: 'Date as YYYY-MM-DD',
  chooseProduct: 'Choose a product',
  barcode: '8–14 digits',
  quantityWithUnit: 'Quantity and unit go together',
  chooseSex: 'Choose sex',
  chooseActivity: 'Choose activity',
  timeFormat: 'Time as HH:MM, e.g. 08:30',
  futureTime: 'Time cannot be in the future',
};

export const errors: Messages<typeof ruErrors> = {
  duplicateBarcode: 'A product with this barcode already exists',
  backup: {
    notBackup: 'This is not a Rekomp backup file',
    newerVersion: 'The backup is from a newer app version — update the app',
    noData: 'The file has no data',
    corrupt: 'The backup file is damaged ({{n}})',
    notJson: 'The file cannot be read as JSON',
    shareUnavailable: 'Sharing files is not available on this device',
  },
};
