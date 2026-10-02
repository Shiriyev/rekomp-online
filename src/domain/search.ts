// One collator: `localeCompare(x, 'ru')` builds a new one per comparison on Hermes.
const ruCollator = new Intl.Collator('ru');

/** Lowercase and strip accents so "turo" finds "túró" and "ё" matches "е". */
export function normalizeForSearch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ё/g, 'е').trim();
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
