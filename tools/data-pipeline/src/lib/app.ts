/**
 * App modules the pipeline reuses as is: the catalog schema/validator/criteria and the v1
 * seed content (16 own recipes, 31 products, Lidl packages, their English texts).
 */
export { RECIPE_CRITERIA, proteinCriteria } from '../../../../src/db/catalog/criteria';
export {
  catalogSchema,
  CATALOG_CATEGORIES,
  type Catalog,
  type CatalogIngredient,
  type CatalogLine,
  type CatalogRecipe,
  type CatalogStep,
  type CatalogVariant,
} from '../../../../src/db/catalog/schema';
export { validateCatalog, type V1IdMap, type V1Ids } from '../../../../src/db/catalog/validate';
export { SEED_RECIPES, type SeedRecipe } from '../../../../src/db/seed/recipes';
export { SEED_INGREDIENTS } from '../../../../src/db/seed/ingredients';
export { SEED_LIDL } from '../../../../src/db/seed/lidl';
export { RECIPES_EN } from '../../../../src/i18n/content/en';
