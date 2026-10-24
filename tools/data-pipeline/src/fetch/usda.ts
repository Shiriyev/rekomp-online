/**
 * fetch:usda — FoodData Central bulk CSV (Foundation Foods + SR Legacy), public domain.
 * The download links are read from the official downloads page; zips are cached and
 * unpacked into raw/usda/<dataset>/. A second run downloads nothing.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { config } from '../../pipeline.config.ts';
import { get } from '../lib/http.ts';
import { ensureDir, RAW } from '../lib/paths.ts';

const dir = ensureDir(path.join(RAW, 'usda'));

/** Every matching file name on the page; dates in the names sort lexicographically. */
export function latestLink(html: string, pattern: RegExp): string | null {
  const names = [...html.matchAll(new RegExp(pattern.source, 'g'))].map((m) => m[0]);
  return names.sort().at(-1) ?? null;
}

async function main() {
  const extracted = Object.keys(config.usda.datasets).every((name) =>
    existsSync(path.join(dir, name)),
  );
  if (extracted) {
    console.log('usda: already downloaded and extracted (0 requests)');
    return;
  }
  const html = await (await get(config.usda.downloadsPage, 'text/html')).text();
  for (const [name, pattern] of Object.entries(config.usda.datasets)) {
    const file = latestLink(html, pattern);
    if (!file) throw new Error(`No ${name} CSV link on ${config.usda.downloadsPage}`);
    const zip = path.join(dir, file);
    const out = path.join(dir, name);
    if (!existsSync(zip)) {
      console.log(`usda: downloading ${file}`);
      const res = await get(`${config.usda.origin}/fdc-datasets/${file}`, 'application/zip');
      writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    }
    if (!existsSync(out)) {
      ensureDir(out);
      // Junk paths: the CSVs land directly in raw/usda/<dataset>/. No member pattern —
      // the CSVs sit in a folder inside the zip, which «*.csv» fails to match on some
      // unzip builds (Windows), leaving the directory empty and the run silently CSV-less.
      execFileSync('unzip', ['-q', '-j', '-o', zip, '-d', out]);
    }
    const csvs = readdirSync(out).filter((f) => f.endsWith('.csv'));
    console.log(`usda: ${name} = ${file} (${csvs.length} CSV files)`);
  }
}

if (import.meta.main) await main();
