// One collator: `localeCompare(x, 'ru')` builds a new one per comparison on Hermes.
const ruCollator = new Intl.Collator('ru');

const normalized = new Map<string, string>();
const MAX_CACHED = 5000;

/** Lowercase and strip accents so "turo" finds "túró" and "ё" matches "е". Cached per text. */
export function normalizeForSearch(text: string): string {
  const hit = normalized.get(text);
  if (hit !== undefined) return hit;
  const value = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ё/g, 'е')
    .trim();
  // Product names repeat on every keystroke; the query changes each time, so bound it.
  if (normalized.size >= MAX_CACHED) normalized.clear();
  normalized.set(text, value);
  return value;
}

/** `aliases`: other names to match (e.g. the English one). */
type Searchable = { name: string; nameHu: string | null; aliases?: readonly string[] };

/** Case/accent-insensitive search over Russian, Hungarian and alias names; prefix matches first. */
export function searchIngredients<T extends Searchable>(items: readonly T[], query: string): T[] {
  const q = normalizeForSearch(query);
  if (q === '') return [...items];
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const names = [item.name, item.nameHu ?? '', ...(item.aliases ?? [])].map(normalizeForSearch);
    const prefix = names.some(
      (n) => n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q)),
    );
    const contains = names.some((n) => n.includes(q));
    if (prefix || contains) scored.push({ item, score: prefix ? 0 : 1 });
  }
  return scored
    .sort((a, b) => a.score - b.score || ruCollator.compare(a.item.name, b.item.name))
    .map((s) => s.item);
}

/** Letter pairs of a word, for the Dice similarity («брокали» ~ «брокколи»). */
function bigrams(word: string): Map<string, number> {
  const padded = ` ${word} `;
  const out = new Map<string, number>();
  for (let i = 0; i < padded.length - 1; i++) {
    const pair = padded.slice(i, i + 2);
    out.set(pair, (out.get(pair) ?? 0) + 1);
  }
  return out;
}

/** Dice coefficient of two strings, 0…1. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const x = bigrams(a);
  const y = bigrams(b);
  let shared = 0;
  let total = 0;
  for (const [pair, n] of x) {
    shared += Math.min(n, y.get(pair) ?? 0);
    total += n;
  }
  for (const n of y.values()) total += n;
  // Padding gives every string at least two pairs, so `total` is never 0.
  return (2 * shared) / total;
}

/** Below this, a «similar» product is just noise. */
const MIN_SIMILARITY = 0.5;

/**
 * Products whose name looks like the query although it is not a match (typos, other word
 * forms): offered when the search finds nothing. Compares with whole names and their words.
 */
export function suggestSimilar<T extends Searchable>(
  items: readonly T[],
  query: string,
  limit = 5,
): T[] {
  const q = normalizeForSearch(query);
  if (q.length < 2) return [];
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    let best = 0;
    for (const name of [item.name, item.nameHu ?? '', ...(item.aliases ?? [])]) {
      const n = normalizeForSearch(name);
      if (!n) continue;
      best = Math.max(best, similarity(q, n), ...n.split(/\s+/).map((w) => similarity(q, w)));
    }
    if (best >= MIN_SIMILARITY) scored.push({ item, score: best });
  }
  return scored
    .sort((a, b) => b.score - a.score || ruCollator.compare(a.item.name, b.item.name))
    .slice(0, limit)
    .map((s) => s.item);
}
