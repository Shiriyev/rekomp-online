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

export type SearchIndex<T> = {
  /** Matches (prefix matches first), else look-alikes when `fuzzy` is set; all for ''. */
  search: (query: string, options?: { fuzzy?: boolean }) => { items: T[]; similar: boolean };
};

/**
 * Search over a fixed list, normalised once: the screens rebuild it when the list changes,
 * not on every keystroke. `names` gives every name to match (any language, synonyms).
 * Results keep the list's order within the prefix and the contains group.
 */
export function createSearchIndex<T>(
  items: readonly T[],
  names: (item: T) => readonly (string | null | undefined)[],
): SearchIndex<T> {
  const entries = items.map((item) => {
    const full = names(item).flatMap((n) => {
      const v = n ? normalizeForSearch(n) : '';
      return v ? [v] : [];
    });
    return { item, full, words: full.flatMap((n) => n.split(/\s+/)) };
  });
  return {
    search(query, options) {
      const q = normalizeForSearch(query);
      if (q === '') return { items: [...items], similar: false };
      const prefix: T[] = [];
      const contains: T[] = [];
      for (const e of entries) {
        if (e.full.some((n) => n.startsWith(q)) || e.words.some((w) => w.startsWith(q)))
          prefix.push(e.item);
        else if (e.full.some((n) => n.includes(q))) contains.push(e.item);
      }
      if (prefix.length + contains.length > 0 || !options?.fuzzy || q.length < 2)
        return { items: [...prefix, ...contains], similar: false };
      const scored: { item: T; score: number }[] = [];
      for (const e of entries) {
        let best = 0;
        for (const n of [...e.full, ...e.words]) best = Math.max(best, similarity(q, n));
        if (best >= MIN_SIMILARITY) scored.push({ item: e.item, score: best });
      }
      // Stable sort: equal scores keep the list order.
      scored.sort((a, b) => b.score - a.score);
      return { items: scored.map((s) => s.item), similar: true };
    },
  };
}
