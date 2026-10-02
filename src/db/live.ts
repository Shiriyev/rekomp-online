import { getTableName, is, Table } from 'drizzle-orm';
import { useMemo, useSyncExternalStore } from 'react';

/**
 * Live queries, a drop-in for drizzle's `useLiveQuery` built for this app's load:
 *
 * - **coalesced**: SQLite reports changes per row; all changes within one burst re-run a
 *   query once, not once per row;
 * - **shared**: identical queries (same SQL and parameters) on several mounted screens
 *   run once and share the result;
 * - **stable**: a re-run that returns equal rows keeps the previous array, so nothing
 *   re-renders and no memo downstream recomputes;
 * - **synchronous first read**: expo-sqlite runs in sync mode here, so a screen renders
 *   with its data instead of an empty pass followed by a second render;
 * - **join-aware**: a query re-runs when any table it reads changes, not only the first.
 */

/** The part of a drizzle select builder this module needs. */
export type LiveQuery<T> = {
  all(): T[];
  toSQL(): { sql: string; params: unknown[] };
};

type Entry = {
  key: string;
  run: () => unknown[];
  tables: ReadonlySet<string>;
  data: unknown[];
  stale: boolean;
  listeners: Set<() => void>;
  evictTimer: ReturnType<typeof setTimeout> | null;
};

export type ChangeSource = (onChange: (tableName: string) => void) => () => void;

/** How long a query nobody watches stays cached (going back to a screen reuses it). */
const KEEP_UNUSED_MS = 10_000;
/** Changes arriving within this window are applied together. */
const COALESCE_MS = 8;

/** Tables a select builder reads: its FROM table and every joined table. */
export function tablesOf(query: unknown): Set<string> {
  const config = (query as { config?: { table?: unknown; joins?: { table: unknown }[] } }).config;
  const names = new Set<string>();
  for (const t of [config?.table, ...(config?.joins ?? []).map((j) => j.table)]) {
    if (t && is(t, Table)) names.add(getTableName(t));
  }
  return names;
}

/** Structural equality for query rows (plain values, arrays and objects from JSON columns). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}

export function createLiveStore(changes: ChangeSource) {
  const entries = new Map<string, Entry>();
  const dirty = new Set<string>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let stopListening: (() => void) | null = null;

  const runEntry = (entry: Entry): boolean => {
    let next: unknown[];
    try {
      next = entry.run();
    } catch (error) {
      // Keep showing the last good rows; a failing query must not take the screen down.
      if (__DEV__) console.warn(`live query failed: ${entry.key}`, error);
      return false;
    }
    entry.stale = false;
    if (deepEqual(next, entry.data)) return false;
    entry.data = next;
    return true;
  };

  const flush = () => {
    flushTimer = null;
    const tables = new Set(dirty);
    dirty.clear();
    const changed: Entry[] = [];
    for (const entry of entries.values()) {
      if (![...entry.tables].some((t) => tables.has(t))) continue;
      if (entry.listeners.size === 0) {
        entry.stale = true; // re-run when someone watches it again
        continue;
      }
      if (runEntry(entry)) changed.push(entry);
    }
    // Notified together: React batches these into one render.
    for (const entry of changed) for (const l of entry.listeners) l();
  };

  const ensureListening = () => {
    stopListening ??= changes((tableName) => {
      dirty.add(tableName);
      flushTimer ??= setTimeout(flush, COALESCE_MS);
    });
  };

  /** The shared entry for this query, created (and read synchronously) on first use. */
  const acquire = <T>(query: LiveQuery<T>): Entry => {
    ensureListening();
    const { sql, params } = query.toSQL();
    const key = `${sql}\u0000${JSON.stringify(params)}`;
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        key,
        run: () => query.all(),
        tables: tablesOf(query),
        data: [],
        stale: true,
        listeners: new Set(),
        evictTimer: null,
      };
      entries.set(key, entry);
      // Dropped again if the render that asked for it never subscribes.
      scheduleEviction(entry);
    }
    if (entry.stale) runEntry(entry);
    return entry;
  };

  const scheduleEviction = (entry: Entry) => {
    entry.evictTimer ??= setTimeout(() => {
      entry.evictTimer = null;
      if (entry.listeners.size === 0) entries.delete(entry.key);
    }, KEEP_UNUSED_MS);
  };

  const subscribe = (entry: Entry, listener: () => void) => {
    if (entry.evictTimer) {
      clearTimeout(entry.evictTimer);
      entry.evictTimer = null;
    }
    entry.listeners.add(listener);
    // A change may have landed between the render and this subscription.
    if (entry.stale && runEntry(entry)) listener();
    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0) scheduleEviction(entry);
    };
  };

  return {
    acquire,
    subscribe,
    /** Applies pending changes now (tests). */
    flush: () => {
      if (flushTimer) clearTimeout(flushTimer);
      flush();
    },
    size: () => entries.size,
    /** Stops listening and clears timers (tests). */
    dispose: () => {
      if (flushTimer) clearTimeout(flushTimer);
      for (const e of entries.values()) if (e.evictTimer) clearTimeout(e.evictTimer);
      entries.clear();
      stopListening?.();
      stopListening = null;
    },
  };
}

export type LiveStore = ReturnType<typeof createLiveStore>;

/**
 * `useLiveQuery(query, deps)` with drizzle's signature. `deps` decide when the query is
 * rebuilt (as in drizzle); `updatedAt` is set once the first read happened, which is
 * immediately.
 */
export function makeUseLiveQuery(store: LiveStore) {
  return function useLiveQuery<T>(
    query: LiveQuery<T>,
    deps: readonly unknown[] = [],
  ): { data: T[]; updatedAt: Date | undefined } {
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's, as in drizzle
    const entry = useMemo(() => store.acquire(query), deps);
    const subscribe = useMemo(() => (l: () => void) => store.subscribe(entry, l), [entry]);
    const data = useSyncExternalStore(subscribe, () => entry.data) as T[];
    return { data, updatedAt: LOADED };
  };
}

const LOADED = new Date(0);
