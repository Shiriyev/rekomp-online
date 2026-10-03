import catalogCredits from '../../../assets/images/catalog/credits.json';
import v1Credits from '../../../assets/images/manifest.json';

export type DataSourceId = 'mealdb' | 'usda' | 'pexels';

export const DATA_SOURCES: readonly { id: DataSourceId; url: string }[] = [
  { id: 'mealdb', url: 'https://www.themealdb.com' },
  { id: 'usda', url: 'https://fdc.nal.usda.gov' },
  { id: 'pexels', url: 'https://www.pexels.com' },
];

export type Photographer = { name: string; url: string | null; photos: number };

/** Pexels photographers of every bundled photo (v1 photos and the catalog), by name. */
export const PHOTOGRAPHERS: readonly Photographer[] = (() => {
  const byName = new Map<string, Photographer>();
  const add = (name: string | null, url: string | null) => {
    if (!name) return;
    const prev = byName.get(name);
    byName.set(name, { name, url: prev?.url ?? url, photos: (prev?.photos ?? 0) + 1 });
  };
  for (const c of v1Credits as { photographer: string; photographerUrl: string }[])
    add(c.photographer, c.photographerUrl);
  for (const c of catalogCredits as {
    source: string;
    author: string | null;
    authorUrl: string | null;
  }[])
    if (c.source === 'Pexels') add(c.author, c.authorUrl);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
})();
