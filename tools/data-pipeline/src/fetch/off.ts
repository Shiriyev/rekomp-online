/**
 * fetch:off — Open Food Facts products sold at Lidl in Hungary (database ODbL, images
 * CC BY-SA). Uses the v2 search API within its 10 req/min limit and the User-Agent with a
 * contact that OFF asks for. Pages are cached in raw/off/; a second run makes no requests.
 */
import path from 'node:path';

import { config } from '../../pipeline.config.ts';
import { cachedJson, sleep } from '../lib/http.ts';
import { RAW } from '../lib/paths.ts';

type SearchPage = { count: number; page: number; page_size: number; products: { code: string }[] };

const dir = path.join(RAW, 'off');
const { base, stores, country, pageSize, pauseMs, fields } = config.off;

async function main() {
  if (!process.env.PIPELINE_CONTACT) {
    throw new Error(
      'Open Food Facts asks for a contact in the User-Agent: set PIPELINE_CONTACT=<email or URL> in .env.local',
    );
  }
  const url = (page: number) =>
    `${base}?stores_tags=${stores}&countries_tags=${country}&page_size=${pageSize}&page=${page}` +
    `&fields=${fields.join(',')}`;

  let requests = 0;
  let total = Infinity;
  const codes = new Set<string>();
  for (let page = 1; (page - 1) * pageSize < total; page++) {
    const { data, fetched } = await cachedJson<SearchPage>(
      path.join(dir, `page-${String(page).padStart(3, '0')}.json`),
      url(page),
    );
    total = data.count;
    for (const p of data.products) codes.add(p.code);
    if (data.products.length === 0) break;
    if (fetched) {
      requests++;
      await sleep(pauseMs);
    }
  }
  console.log(`off: ${codes.size} products (of ${total} reported, ${requests} requests)`);
}

await main();
