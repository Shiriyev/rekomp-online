import type { backup as ru } from '../ru/backup';
import type { Messages } from '../types';

export const backup: Messages<typeof ru> = {
  title: 'Data',
  privacy:
    'Everything is stored only on this phone. A backup is a file with your data (including weight): keep it somewhere safe.',
  noPhotos: 'Photos are not included in the backup.',
  export: 'Export',
  import: 'Import',
  resetAll: 'Reset all data',
  photoCredits: 'Dish and product photos by Pexels authors (pexels.com), listed in ATTRIBUTION.md.',
  shareTitle: 'Rekomp backup',
  unknownDate: 'unknown',
  importTitle: 'Restore from backup?',
  importText: 'Backup from {{date}}, food entries: {{entries}}. All current data will be replaced.',
  replace: 'Replace',
  restored: 'Data restored',
  reset1Title: 'Reset all data?',
  reset1Text:
    'This deletes your profile, diary, products, lists and catalogue. You can export first.',
  reset2Title: 'Delete everything?',
  reset2Text: 'This cannot be undone.',
  no: 'No',
  deleteAll: 'Delete everything',
};
