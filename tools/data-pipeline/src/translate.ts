/**
 * translate — PHASE_2 task 4. One Claude API call per accepted recipe: Russian name,
 * short descriptions (ru/en), the instructions split into one-action steps (ru/en) with
 * timers only for stated durations and references to the recipe's products, plus
 * mealTypes / isBatch / prepNightBefore suggestions. No grams or macros are asked for.
 *
 * - answers are validated (zod schema + checkTranslation); an invalid answer is retried
 *   at most twice with the errors fed back, then the recipe goes to reports/needs-review.md;
 * - results are cached in cache/translate/<id>.json by a hash of the input, the prompt and
 *   the model, so a re-run only translates what changed;
 * - needs ANTHROPIC_API_KEY (from the repo's .env.local).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

import type { Accepted } from './build/evaluate.ts';
import { loadMappings } from './build/mappings.ts';
import { ensureDir, REPORTS, ROOT } from './lib/paths.ts';
import {
  checkTranslation,
  translationInput,
  translationSchema,
  translationWarnings,
  type Translation,
  type TranslationInput,
} from './translate/check.ts';

const MODEL = 'claude-opus-5-5';
const MAX_ATTEMPTS = 3; // the first answer + at most 2 retries
const CONCURRENCY = 4;
const CACHE = path.join(ROOT, 'cache', 'translate');

const SYSTEM = `You localize recipes for a Russian-language meal-planning app (an English UI also exists).
You receive one recipe from TheMealDB as JSON: its English name, category, cuisine, the original
instructions and the ingredient list (each with an id, the source name, the reviewed Russian
product name and the source measure).

Return:
- nameRu: a natural Russian dish name (keep well-known foreign names in their usual Russian form).
- descriptionRu / descriptionEn: one short sentence each describing the dish. No numbers, no health claims.
- steps: the instructions rewritten as an ordered list. Each step is exactly ONE action
  (split "chop the onion and fry it" into two steps). Give every step in Russian (ru, imperative,
  «Нарежьте…») and in English (en). Use the reviewed Russian product names. Drop chatter that is
  not an action ("Enjoy!", personal stories). Keep temperatures as written in the source.
- timerSec: only when the source text states a duration for that action; use that duration in
  seconds (for a range like "20 to 30 minutes" use one of the two ends). Otherwise null.
  Never invent or estimate a time.
- ingredientRefs: ids (from the given list only) of the products used in that step; [] if none.
- mealTypes: which of breakfast, lunch, dinner, snack this dish suits.
- isBatch: true if the dish is typically cooked in advance for several days (stews, casseroles, soups).
- prepNightBefore: true if the source requires something the evening before (overnight marinating, soaking).

Never output quantities, grams, calories or other nutrition values.`;

type CacheEntry = { hash: string; translation: Translation; warnings: string[] };
type Failure = { id: string; nameEn: string; errors: string[] };

function hashOf(input: TranslationInput): string {
  return createHash('sha256').update(JSON.stringify({ MODEL, SYSTEM, input })).digest('hex');
}

function cacheFile(id: string) {
  return path.join(CACHE, `${id}.json`);
}

function readCache(id: string, hash: string): CacheEntry | undefined {
  const file = cacheFile(id);
  if (!existsSync(file)) return undefined;
  const entry = JSON.parse(readFileSync(file, 'utf8')) as CacheEntry;
  return entry.hash === hash ? entry : undefined;
}

async function translateOne(
  client: Anthropic,
  input: TranslationInput,
): Promise<{ translation: Translation } | { errors: string[] }> {
  let errors: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const retryNote =
      errors.length === 0
        ? ''
        : `\n\nYour previous answer was rejected for these reasons, fix them:\n- ${errors.join('\n- ')}`;
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Re-serves a declined request on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(input) + retryNote }],
      output_config: { effort: 'medium', format: betaZodOutputFormat(translationSchema) },
    });
    if (response.stop_reason === 'refusal') {
      errors = ['the model declined the request'];
      continue;
    }
    if (response.stop_reason === 'max_tokens') {
      errors = ['the answer was cut off (max_tokens)'];
      continue;
    }
    const parsed = response.parsed_output;
    if (!parsed) {
      errors = ['the answer did not match the JSON schema'];
      continue;
    }
    errors = checkTranslation(parsed, input);
    if (errors.length === 0) return { translation: parsed };
  }
  return { errors };
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pool<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

async function main() {
  const accepted = JSON.parse(
    readFileSync(path.join(ROOT, 'cache', 'evaluated.json'), 'utf8'),
  ) as Accepted[];
  const { translations } = loadMappings();
  const inputs = accepted.map((r) => translationInput(r, translations));
  ensureDir(CACHE);

  const todo = inputs.filter((i) => !readCache(i.id, hashOf(i)));
  if (todo.length > 0 && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      `ANTHROPIC_API_KEY is not set (add it to .env.local); ${todo.length} recipes need translation`,
    );
  }

  const client = new Anthropic({ maxRetries: 4 });
  const failures: Failure[] = [];
  let done = 0;
  await pool(todo, CONCURRENCY, async (input) => {
    try {
      const result = await translateOne(client, input);
      if ('errors' in result) {
        failures.push({ id: input.id, nameEn: input.nameEn, errors: result.errors });
      } else {
        const entry: CacheEntry = {
          hash: hashOf(input),
          translation: result.translation,
          warnings: translationWarnings(result.translation),
        };
        writeFileSync(cacheFile(input.id), JSON.stringify(entry, null, 1));
      }
    } catch (e) {
      // Auth/permission problems hit every recipe the same way: stop instead of repeating.
      if (
        e instanceof Anthropic.AuthenticationError ||
        e instanceof Anthropic.PermissionDeniedError
      )
        throw e;
      const message = e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : String(e);
      failures.push({ id: input.id, nameEn: input.nameEn, errors: [message] });
    }
    done++;
    if (done % 10 === 0) console.log(`translate: ${done}/${todo.length}`);
  });

  failures.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(
    path.join(REPORTS, 'needs-review.md'),
    [
      '# Recipes that need review',
      '',
      `Translation failed after ${MAX_ATTEMPTS} attempts. Fix by hand in mappings/recipe-overrides.json or re-run \`npm run translate\`.`,
      '',
      failures.length === 0
        ? 'None.'
        : failures
            .map((f) => `- **${f.nameEn}** (${f.id})\n  - ${f.errors.join('\n  - ')}`)
            .join('\n'),
      '',
    ].join('\n'),
  );

  console.log(
    `translate: ${inputs.length} recipes, ${inputs.length - todo.length} from cache, ` +
      `${todo.length - failures.length} translated now, ${failures.length} need review`,
  );
}

await main();
