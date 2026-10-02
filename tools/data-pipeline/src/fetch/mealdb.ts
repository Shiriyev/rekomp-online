/**
 * fetch:mealdb — every TheMealDB recipe (search by first letter a–z) plus the category
 * list. Raw responses are cached in raw/mealdb/; a second run makes no requests.
 */
import path from 'node:path';

import { config } from '../../pipeline.config.ts';
import { cachedJson, sleep } from '../lib/http.ts';
import { RAW } from '../lib/paths.ts';

export type MealDbMeal = Record<string, string | null> & { idMeal: string; strMeal: string };
type SearchResponse = { meals: MealDbMeal[] | null };

const dir = path.join(RAW, 'mealdb');
const { base, letters, pauseMs } = config.mealdb;

async function main() {
  let requests = 0;
  const pause = async (fetched: boolean) => {
    if (fetched) {
      requests++;
      await sleep(pauseMs);
    }
  };

  const categories = await cachedJson<{ meals: { strCategory: string }[] }>(
    path.join(dir, 'categories.json'),
    `${base}/list.php?c=list`,
  );
  await pause(categories.fetched);

  const ids = new Set<string>();
  for (const letter of letters) {
    const { data, fetched } = await cachedJson<SearchResponse>(
      path.join(dir, `search-${letter}.json`),
      `${base}/search.php?f=${letter}`,
    );
    for (const meal of data.meals ?? []) ids.add(meal.idMeal);
    await pause(fetched);
  }

  console.log(
    `mealdb: ${ids.size} recipes, ${categories.data.meals.length} categories (${requests} requests)`,
  );
}

await main();
