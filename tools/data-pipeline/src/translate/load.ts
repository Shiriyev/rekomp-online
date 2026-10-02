/**
 * Final recipe texts: the cached model translation with mappings/recipe-overrides.json on
 * top (a reviewer's fields always win). Used by `report` and the catalog build.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { MAPPINGS, ROOT } from '../lib/paths.ts';
import { translationSchema, type Translation } from './check.ts';

const overridesSchema = z.record(z.string(), translationSchema.partial().strict());

export function loadOverrides(): Record<string, Partial<Translation>> {
  const file = path.join(MAPPINGS, 'recipe-overrides.json');
  if (!existsSync(file)) return {};
  return overridesSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export type LoadedTranslation = {
  translation: Translation;
  warnings: string[];
  overridden: boolean;
};

/** The translation for a recipe, or undefined when neither the cache nor a full override has one. */
export function loadTranslation(
  id: string,
  overrides: Record<string, Partial<Translation>>,
): LoadedTranslation | undefined {
  const file = path.join(ROOT, 'cache', 'translate', `${id}.json`);
  const cached = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as { translation: Translation; warnings: string[] })
    : undefined;
  const override = overrides[id];
  if (!cached) {
    const full = override ? translationSchema.safeParse(override) : undefined;
    return full?.success ? { translation: full.data, warnings: [], overridden: true } : undefined;
  }
  return {
    translation: { ...cached.translation, ...override },
    warnings: override ? [] : cached.warnings,
    overridden: override !== undefined,
  };
}
