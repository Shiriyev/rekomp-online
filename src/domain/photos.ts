/** Meal photos: stored as JPEG, long side at most 1280 px, quality 0.7. */
export const PHOTO_MAX_SIDE = 1280;
export const PHOTO_JPEG_QUALITY = 0.7;
export const PHOTO_DIR_NAME = 'meal-photos';
/** Orphan sweep runs at most once a day. */
export const PHOTO_CLEANUP_INTERVAL_MS = 24 * 3_600_000;

/**
 * Resize that brings the long side down to `maxSide`, keeping the aspect ratio
 * (only one side is given). Null when the image is already small enough.
 */
export function resizeToFit(
  width: number,
  height: number,
  maxSide: number = PHOTO_MAX_SIDE,
): { width: number } | { height: number } | null {
  if (width <= maxSide && height <= maxSide) return null;
  return width >= height ? { width: maxSide } : { height: maxSide };
}

/** Last path segment of a URI or path ("file:///a/b/x.jpg" → "x.jpg"). */
export function fileNameOf(uri: string): string {
  const clean = uri.replace(/[?#].*$/, '');
  return clean.slice(clean.lastIndexOf('/') + 1);
}

/** File names in the photo folder that no entry points to. */
export function orphanFileNames(
  fileNames: readonly string[],
  referencedUris: readonly (string | null)[],
): string[] {
  const referenced = new Set(referencedUris.flatMap((uri) => (uri ? [fileNameOf(uri)] : [])));
  return fileNames.filter((name) => !referenced.has(name));
}

export function isCleanupDue(
  lastRunMs: number | null,
  now: number,
  intervalMs: number = PHOTO_CLEANUP_INTERVAL_MS,
): boolean {
  return lastRunMs === null || !Number.isFinite(lastRunMs) || now - lastRunMs >= intervalMs;
}
