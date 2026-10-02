import { CATALOG_IMAGES } from './catalogImages';
import { INGREDIENT_IMAGES, RECIPE_IMAGES } from './images';

/**
 * The bundled photo for an imageKey: catalog keys are paths under assets/images
 * («catalog/recipes/mdb_52765», «recipes/z1», «ingredients/tvorog»); rows written before the
 * catalog still carry the short v1 keys («z1», «tvorog»).
 */
export function bundledImage(key: string | null | undefined): number | undefined {
  if (!key) return undefined;
  return CATALOG_IMAGES[key] ?? RECIPE_IMAGES[key] ?? INGREDIENT_IMAGES[key];
}
