import credits from '../../../assets/images/catalog/credits.json';

export type DataSourceId = 'mealdb' | 'usda' | 'off' | 'pexels';

export const DATA_SOURCES: readonly { id: DataSourceId; url: string }[] = [
  { id: 'mealdb', url: 'https://www.themealdb.com' },
  { id: 'usda', url: 'https://fdc.nal.usda.gov' },
  { id: 'off', url: 'https://world.openfoodfacts.org' },
  { id: 'pexels', url: 'https://www.pexels.com' },
];

/** Distinct Pexels photographers credited in the bundled catalog photos. */
export const pexelsAuthorCount = new Set(
  (credits as { source: string; author: string | null }[])
    .filter((c) => c.source === 'Pexels' && c.author)
    .map((c) => c.author),
).size;
