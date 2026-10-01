import { repositories } from '@/db';
import type { ManualLogInput } from '@/domain/schemas';
import { persistPhoto, releasePhoto } from '@/features/photos/mealPhotos';
import { showUndo } from '@/features/undo/undoStore';
import { t } from '@/i18n';

/**
 * Saves a manual entry with its optional photo and deductions, then offers Undo.
 * The photo is moved into storage first; if the entry cannot be saved, it is removed again.
 */
export function saveManualEntry(input: ManualLogInput, photoTempUri: string | null): void {
  let photoUri: string | null = null;
  try {
    photoUri = photoTempUri ? persistPhoto(photoTempUri) : null;
  } catch (e) {
    // The entry matters more than its photo: save it without one.
    if (__DEV__) console.warn('Could not store the photo', e);
  }
  let log;
  try {
    log = repositories.logs.addManual({ ...input, photoUri });
  } catch (e) {
    releasePhoto(photoUri);
    throw e;
  }
  const message =
    photoTempUri && !photoUri
      ? t('addMeal.addedNoPhoto', { name: log.name })
      : t('addMeal.added', { name: log.name });
  showUndo(message, () => {
    repositories.logs.undo(log.id);
    releasePhoto(log.photoUri);
  });
}
