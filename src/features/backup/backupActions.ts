import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db } from '@/db';
import {
  backupFileName,
  BackupFormatError,
  exportBackup,
  importBackup,
  parseBackup,
  resetAllData,
  type Backup,
} from '@/db/backup';
import { useCookStore } from '@/features/cooking/cookStore';
import { t } from '@/i18n';

/** Writes the backup to the cache and opens the system share sheet (Drive, Telegram, files…). */
export async function exportAndShare(): Promise<void> {
  const backup = exportBackup(db);
  const file = new File(Paths.cache, backupFileName());
  file.create({ overwrite: true });
  file.write(JSON.stringify(backup));
  // Message keys are rendered with translateMessage where the error is shown.
  if (!(await Sharing.isAvailableAsync())) throw new Error('errors.backup.shareUnavailable');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: t('backup.shareTitle'),
  });
}

export type PickedBackup = { backup: Backup; entries: number };

/** Lets the user pick a file and validates it; null when cancelled. */
export async function pickBackup(): Promise<PickedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(await new File(asset.uri).text());
  } catch {
    throw new BackupFormatError('errors.backup.notJson');
  }
  const backup = parseBackup(raw);
  return { backup, entries: backup.tables.meal_logs.length };
}

/** Replaces all data; the in-memory cooking session is dropped so it reloads from the DB. */
export function applyBackup(backup: Backup): void {
  importBackup(db, backup);
  useCookStore.getState().leave();
}

export function resetEverything(): void {
  resetAllData(db);
  useCookStore.getState().leave();
}
