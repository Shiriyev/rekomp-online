/**
 * photo:candidates — for products whose TheMealDB image shows a brand
 * (mappings/branded-ingredient-images.json), fetch three Pexels candidates each and lay
 * them out on review sheets (reports/candidates-N.jpg). A person picks one per product
 * in mappings/photo-picks.json ({ "<id>": 0 | 1 | 2 }); `photo:apply` ships the picks.
 * Products without a pick lose the branded picture and show the category icon.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import { config } from '../pipeline.config.ts';
import { loadMappings } from './build/mappings.ts';
import { get, sleep } from './lib/http.ts';
import { ensureDir, MAPPINGS, RAW, REPORTS } from './lib/paths.ts';

type Candidate = {
  url: string;
  photographer: string;
  photographer_url: string;
  src: { medium: string };
};
export type CandidateCredit = { author: string; authorUrl: string; pageUrl: string; query: string };

export const CANDIDATES = path.join(RAW, 'images', 'pexels-candidates');
export const brandedIds = (): string[] =>
  JSON.parse(
    readFileSync(path.join(MAPPINGS, 'branded-ingredient-images.json'), 'utf8'),
  ) as string[];
/** «Tvorog (quark)» → «Tvorog»: Pexels matches the plain name better. */
export const queryFor = (nameEn: string) => nameEn.replace(/\s*\(.*?\)\s*/g, ' ').trim();

async function main() {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error('PEXELS_API_KEY is not set (.env.local)');
  const { canonical } = loadMappings();
  const byId = new Map(canonical.map((p) => [p.id, p]));
  ensureDir(CANDIDATES);
  const ids = brandedIds().filter((id) => byId.has(id));
  let searches = 0;
  for (const id of ids) {
    const meta = path.join(CANDIDATES, `${id}.json`);
    if (existsSync(meta)) continue;
    const query = queryFor(byId.get(id)!.nameEn);
    const res = await fetch(
      `https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: '3', orientation: 'square' })}`,
      { headers: { Authorization: apiKey } },
    );
    if (res.status === 429) throw new Error('Pexels rate limit: run again later, progress is kept');
    if (!res.ok) throw new Error(`Pexels search failed: ${res.status}`);
    const photos = ((await res.json()) as { photos?: Candidate[] }).photos ?? [];
    searches++;
    const credits: (CandidateCredit | null)[] = [];
    for (const [i, p] of photos.entries()) {
      const file = path.join(CANDIDATES, `${id}-${i}.jpg`);
      try {
        const img = await get(p.src.medium, 'image/*');
        writeFileSync(file, Buffer.from(await img.arrayBuffer()));
      } catch {
        credits.push(null); // keeps the index: this candidate cannot be picked
        continue;
      }
      credits.push({
        author: p.photographer,
        authorUrl: p.photographer_url,
        pageUrl: p.url,
        query,
      });
    }
    writeFileSync(meta, JSON.stringify(credits));
    await sleep(config.images.pexelsPauseMs);
  }

  // Review sheets: one row per product, its three candidates side by side.
  const ROWS = 8;
  const W = 240;
  ensureDir(REPORTS);
  for (let s = 0; s * ROWS < ids.length; s++) {
    const page = ids.slice(s * ROWS, (s + 1) * ROWS);
    const comps: OverlayOptions[] = [];
    for (const [r, id] of page.entries()) {
      const label = Buffer.from(
        `<svg width="200" height="${W}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="120" font-size="18" fill="#fff" font-family="Arial">${id}</text></svg>`,
      );
      comps.push({ input: label, left: 0, top: r * W });
      for (let i = 0; i < 3; i++) {
        const file = path.join(CANDIDATES, `${id}-${i}.jpg`);
        if (!existsSync(file)) continue;
        comps.push({
          input: await sharp(file)
            .resize(W - 8, W - 8, { fit: 'cover' })
            .toBuffer(),
          left: 200 + i * W,
          top: r * W,
        });
      }
    }
    await sharp({
      create: { width: 200 + 3 * W, height: ROWS * W, channels: 3, background: '#333' },
    })
      .composite(comps)
      .jpeg({ quality: 70 })
      .toFile(path.join(REPORTS, `candidates-${s}.jpg`));
  }
  console.log(`photo:candidates: ${ids.length} products, ${searches} Pexels searches`);
}

/**
 * Ships the picks: the chosen candidate becomes the product's reviewed Pexels photo (raw
 * file, credit sidecar and an approved entry in photo-review.json); `npm run images` then
 * converts it like any other reviewed photo.
 */
export function applyPicks(): number {
  const picks = JSON.parse(readFileSync(path.join(MAPPINGS, 'photo-picks.json'), 'utf8')) as Record<
    string,
    number
  >;
  const reviewFile = path.join(MAPPINGS, 'photo-review.json');
  const review = JSON.parse(readFileSync(reviewFile, 'utf8')) as Record<string, unknown>;
  let applied = 0;
  for (const [id, index] of Object.entries(picks)) {
    const credits = JSON.parse(
      readFileSync(path.join(CANDIDATES, `${id}.json`), 'utf8'),
    ) as (CandidateCredit | null)[];
    const credit = credits[index];
    if (!credit) throw new Error(`photo-picks: ${id} has no candidate ${index}`);
    const raw = path.join(RAW, 'images', 'pexels', `${id}.jpg`);
    ensureDir(path.dirname(raw));
    writeFileSync(raw, readFileSync(path.join(CANDIDATES, `${id}-${index}.jpg`)));
    writeFileSync(
      raw.replace(/\.jpg$/, '.json'),
      JSON.stringify({
        file: `products/${id}.webp`,
        source: 'Pexels',
        author: credit.author,
        authorUrl: credit.authorUrl,
        pageUrl: credit.pageUrl,
        query: credit.query,
      }),
    );
    review[id] = { query: credit.query, ok: true };
    applied++;
  }
  writeFileSync(reviewFile, JSON.stringify(review, null, 1) + '\n');
  return applied;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--apply'))
    console.log(`photo:candidates: ${applyPicks()} picks applied`);
  else await main();
}
