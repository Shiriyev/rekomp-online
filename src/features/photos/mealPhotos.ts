import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { repositories } from '@/db';
import {
  fileNameOf,
  isCleanupDue,
  orphanFileNames,
  PHOTO_DIR_NAME,
  PHOTO_JPEG_QUALITY,
  resizeToFit,
} from '@/domain/photos';
import { newId } from '@/lib/id';

export type PhotoSource = 'camera' | 'library';

export type PickOutcome =
  | { kind: 'picked'; uri: string }
  | { kind: 'canceled' }
  /** No permission; `canAskAgain` false means only the system settings can fix it. */
  | { kind: 'denied'; source: PhotoSource; canAskAgain: boolean };

const photoDir = () => new Directory(Paths.document, PHOTO_DIR_NAME);

/**
 * Asks for the permission at the moment of the tap, opens the camera or gallery and
 * returns a compressed JPEG in the cache (long side ≤ 1280 px, quality 0.7). Nothing is
 * written to the documents folder until the entry is saved (see `persistPhoto`).
 */
export async function pickPhoto(source: PhotoSource): Promise<PickOutcome> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { kind: 'denied', source, canAskAgain: permission.canAskAgain };
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { kind: 'canceled' };

  return { kind: 'picked', uri: await compress(asset.uri, asset.width, asset.height) };
}

async function compress(uri: string, width: number, height: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  const resize = resizeToFit(width, height);
  if (resize) context.resize(resize);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_JPEG_QUALITY });
  return saved.uri;
}

/** Moves a picked photo into documents/meal-photos/<uuid>.jpg and returns its URI. */
export function persistPhoto(tempUri: string): string {
  const dir = photoDir();
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${newId()}.jpg`);
  new File(tempUri).moveSync(target);
  return target.uri;
}

/** Deletes a stored photo file, unless some entry still points to it. Never throws. */
export function releasePhoto(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    if (repositories.logs.isPhotoReferenced(uri)) return;
    const file = new File(photoDir(), fileNameOf(uri));
    if (file.exists) file.delete();
  } catch (e) {
    // A leftover file is collected by the daily sweep.
    if (__DEV__) console.warn('Could not delete meal photo', e);
  }
}

/**
 * Daily sweep at start-up: removes files in meal-photos/ that no entry references
 * (e.g. the app was closed during an Undo window). Returns how many were removed.
 */
export function cleanupOrphanPhotos(now: number = Date.now()): number {
  try {
    if (!isCleanupDue(repositories.settings.getPhotoCleanupAt(), now)) return 0;
    const dir = photoDir();
    let removed = 0;
    if (dir.exists) {
      const files = dir.list().filter((entry): entry is File => entry instanceof File);
      const orphans = new Set(
        orphanFileNames(
          files.map((f) => f.name),
          repositories.logs.photoUris(),
        ),
      );
      for (const file of files) {
        if (!orphans.has(file.name)) continue;
        file.delete();
        removed++;
      }
    }
    repositories.settings.setPhotoCleanupAt(now);
    return removed;
  } catch (e) {
    if (__DEV__) console.warn('Meal photo cleanup failed', e);
    return 0;
  }
}
