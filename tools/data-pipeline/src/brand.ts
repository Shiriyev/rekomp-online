/**
 * brand — renders the app icons from assets/brand/*.svg (design 1a «Bowl & rise»):
 * store icon, Android adaptive layers (background, foreground, themed monochrome), splash
 * mark and favicon, at the sizes app.json expects.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { APP_ROOT } from './lib/paths.ts';

const BRAND = path.join(APP_ROOT, 'assets', 'brand');
const OUT = path.join(APP_ROOT, 'assets', 'images');
const TILE = '#E8F5E9';

const svg = (name: string) => readFileSync(path.join(BRAND, name));

/** The mark scaled to `share` of a `size` canvas, centred, on `background` (or transparent). */
async function render(
  file: string,
  mark: Buffer,
  size: number,
  share: number,
  background?: string,
) {
  const markSize = Math.round(size * share);
  const layers =
    markSize === 0
      ? [] // a plain fill (the adaptive background)
      : [
          {
            input: await sharp(mark, { density: 1200 }).resize(markSize, markSize).png().toBuffer(),
            left: Math.round((size - markSize) / 2),
            top: Math.round((size - markSize) / 2),
          },
        ];
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toFile(path.join(OUT, file));
}

const colour = svg('mark.svg');
const mono = svg('mark-mono.svg');

// Store / iOS icon: full bleed, the OS rounds the corners. Mark at 62% as in the design.
await render('icon.png', colour, 1024, 0.62, TILE);
// Android adaptive icon: 108 dp canvas, ~66 dp always visible. The mark stays well inside.
await render('android-icon-background.png', colour, 1024, 0, TILE);
await render('android-icon-foreground.png', colour, 1024, 0.4);
await render('android-icon-monochrome.png', mono, 1024, 0.4);
// Splash: white mark on the green splash background (app.json backgroundColor #2E7D32).
await render('splash-icon.png', mono, 1024, 1);
await render('favicon.png', colour, 48, 0.86, TILE);
console.log('brand: icon, adaptive layers, monochrome, splash and favicon rendered');
