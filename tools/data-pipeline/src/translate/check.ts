/**
 * Translation output (PHASE_2 task 4): the zod schema the model must answer with, and the
 * checks the schema cannot express — ingredient references point at the recipe's own
 * products and a timer only exists where the source text states that duration.
 * The model never supplies grams or macros; those come from tasks 2–3.
 */
import { z } from 'zod';

import type { Accepted, MealType } from '../build/evaluate.ts';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const satisfies readonly MealType[];

/**
 * Kept free of length/size constraints on purpose: structured outputs only support a
 * subset of JSON Schema. The semantic limits live in `checkTranslation`.
 */
export const translationSchema = z.object({
  nameRu: z.string(),
  descriptionRu: z.string(),
  descriptionEn: z.string(),
  steps: z.array(
    z.object({
      ru: z.string(),
      en: z.string(),
      timerSec: z.number().int().nullable(),
      ingredientRefs: z.array(z.string()),
    }),
  ),
  mealTypes: z.array(z.enum(MEALS)),
  isBatch: z.boolean(),
  prepNightBefore: z.boolean(),
});
export type Translation = z.infer<typeof translationSchema>;

/** The part of an accepted recipe the model sees; also the cache key input. */
export type TranslationInput = {
  id: string;
  nameEn: string;
  category: string;
  area: string;
  instructions: string;
  servings: number;
  /** `nameRu` is the reviewed product name the Russian steps should use. */
  ingredients: { id: string; name: string; nameRu: string; measure: string }[];
};

export function translationInput(
  r: Accepted,
  ru: Readonly<Record<string, { ru: string }>>,
): TranslationInput {
  return {
    id: r.id,
    nameEn: r.nameEn,
    category: r.category,
    area: r.area,
    instructions: r.instructions,
    servings: r.servings,
    ingredients: r.lines.map((l) => ({
      id: l.ingredientId,
      name: l.rawName,
      nameRu: ru[l.ingredientId]?.ru ?? l.rawName,
      measure: l.rawMeasure,
    })),
  };
}

const DURATION =
  /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|to|or)\s*(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;

/** Every duration stated in the source text, in seconds (both ends of «20 to 30 minutes»). */
export function statedDurations(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(DURATION)) {
    const unit = m[3]!.toLowerCase();
    const factor = unit.startsWith('h') ? 3600 : unit.startsWith('m') ? 60 : 1;
    for (const v of [m[1], m[2]]) {
      if (v === undefined) continue;
      const n = Number(v.replace(',', '.'));
      if (Number.isFinite(n) && n > 0) out.add(Math.round(n * factor));
    }
  }
  return out;
}

const CYRILLIC = /[а-яё]/i;
/** A step longer than this almost always packs several actions; worth a human look. */
export const LONG_STEP_CHARS = 220;

/** Problems that make the answer unusable (→ retry, then needs-review). */
export function checkTranslation(t: Translation, input: TranslationInput): string[] {
  const errors: string[] = [];
  if (!CYRILLIC.test(t.nameRu)) errors.push('nameRu is not Russian');
  if (!CYRILLIC.test(t.descriptionRu)) errors.push('descriptionRu is not Russian');
  if (t.descriptionEn.trim().length === 0) errors.push('descriptionEn is empty');
  if (t.steps.length === 0) errors.push('no steps');
  if (t.mealTypes.length === 0) errors.push('mealTypes is empty');

  const ids = new Set(input.ingredients.map((i) => i.id));
  const durations = statedDurations(input.instructions);
  t.steps.forEach((s, i) => {
    const n = i + 1;
    if (!CYRILLIC.test(s.ru)) errors.push(`step ${n}: ru text is not Russian`);
    if (s.en.trim().length === 0) errors.push(`step ${n}: en text is empty`);
    for (const ref of s.ingredientRefs) {
      if (!ids.has(ref)) errors.push(`step ${n}: unknown ingredient id "${ref}"`);
    }
    if (s.timerSec !== null && !durations.has(s.timerSec)) {
      errors.push(`step ${n}: timer ${s.timerSec}s is not a duration stated in the source`);
    }
  });
  return errors;
}

/** Things a reviewer should glance at; the answer is still used. */
export function translationWarnings(t: Translation): string[] {
  return t.steps.flatMap((s, i) =>
    s.ru.length > LONG_STEP_CHARS ? [`step ${i + 1} is long (${s.ru.length} chars)`] : [],
  );
}
