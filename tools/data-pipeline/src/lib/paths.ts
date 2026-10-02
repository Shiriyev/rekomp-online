import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** tools/data-pipeline/ */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RAW = path.join(ROOT, 'raw');
export const REPORTS = path.join(ROOT, 'reports');
export const MAPPINGS = path.join(ROOT, 'mappings');
/** The app repository root. */
export const APP_ROOT = path.resolve(ROOT, '..', '..');

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}
