import type { AppDb } from '../types';
import { BUNDLED_CATALOG_VERSION } from '../seed/catalogVersion';
import { applyCatalog, type CatalogUpdate } from './apply';
import type { Catalog } from './schema';

/**
 * Applies the catalog shipped with the app when it is newer than the stored one. The JSON
 * (~0.9 MB) is required lazily, so a normal start-up never parses it. It is validated by
 * the test suite and the data pipeline, not at run time.
 */
export function applyBundledCatalog(db: AppDb): CatalogUpdate {
  return applyCatalog(db, BUNDLED_CATALOG_VERSION, () => {
    return require('../seed/catalog.v2.json') as Catalog;
  });
}
