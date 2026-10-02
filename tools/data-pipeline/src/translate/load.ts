/**
 * Final recipe texts: the cached model translation with mappings/recipe-overrides.json on
 * top (a reviewer's fields always win). Used by `report` and the catalog build.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { MAPPINGS, ROOT } from '../lib/paths.ts';
import { translationSchema, translationWarnings, type Translation } from './check.ts';

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

/** Hand-written translations, one file per recipe (committed, unlike the API cache). */
export const MANUAL_DIR = path.join(MAPPINGS, 'recipe-translations');

/** The base translation: a hand-written file wins over the cached API answer. */
function baseTranslation(id: string): { translation: Translation; warnings: string[] } | undefined {
  const manual = path.join(MANUAL_DIR, `${id}.json`);
  if (existsSync(manual)) {
    const translation = translationSchema.parse(JSON.parse(readFileSync(manual, 'utf8')));
    return { translation, warnings: translationWarnings(translation) };
  }
  const cached = path.join(ROOT, 'cache', 'translate', `${id}.json`);
  return existsSync(cached)
    ? (JSON.parse(readFileSync(cached, 'utf8')) as { translation: Translation; warnings: string[] })
    : undefined;
}

/** The translation for a recipe, or undefined when no source and no full override has one. */
export function loadTranslation(
  id: string,
  overrides: Record<string, Partial<Translation>>,
): LoadedTranslation | undefined {
  const base = baseTranslation(id);
  const override = overrides[id];
  if (!base) {
    const full = override ? translationSchema.safeParse(override) : undefined;
    return full?.success ? { translation: full.data, warnings: [], overridden: true } : undefined;
  }
  return {
    translation: { ...base.translation, ...override },
    warnings: override ? [] : base.warnings,
    overridden: override !== undefined,
  };
}
