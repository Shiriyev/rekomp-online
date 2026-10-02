import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { config } from '../../pipeline.config.ts';
import { ensureDir } from './paths.ts';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

/** 429, 5xx and network errors are worth retrying; 4xx otherwise is final. */
const retryable = (e: unknown) => !(e instanceof HttpError) || e.status === 429 || e.status >= 500;

/** GET with a timeout, the pipeline User-Agent and exponential backoff on transient errors. */
export async function get(url: string, accept = 'application/json'): Promise<Response> {
  const { retries, backoffMs, timeoutMs } = config.http;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': config.userAgent, Accept: accept },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return res;
    } catch (e) {
      if (attempt >= retries || !retryable(e)) throw e;
      const wait = backoffMs * 2 ** attempt;
      console.warn(`  retry ${attempt + 1}/${retries} in ${wait} ms: ${(e as Error).message}`);
      await sleep(wait);
    }
  }
}

/**
 * JSON from the cache file when present; otherwise fetched, validated as JSON and cached.
 * `fetched` tells callers whether a request was made (to pause between requests).
 */
export async function cachedJson<T>(
  file: string,
  url: string,
): Promise<{ data: T; fetched: boolean }> {
  if (existsSync(file))
    return { data: JSON.parse(readFileSync(file, 'utf8')) as T, fetched: false };
  const res = await get(url);
  const text = await res.text();
  const data = JSON.parse(text) as T; // throws on HTML error pages: nothing broken gets cached
  ensureDir(path.dirname(file));
  writeFileSync(file, text);
  return { data, fetched: true };
}
