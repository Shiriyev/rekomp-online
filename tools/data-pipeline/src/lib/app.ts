/**
 * App modules the pipeline reuses as is: the catalog schema/validator/criteria and the v1
 * seed content (16 own recipes, 31 products, their English texts).
 */
export { RECIPE_CRITERIA, proteinCriteria } from '../../../../src/db/catalog/criteria';
export {
  catalogSchema,
  CATALOG_CATEGORIES,
  EQUIPMENT,
  HEAT_SOURCES,
  MAIN_PROTEINS,
  type Equipment,
  type MainProtein,
  type Catalog,
  type CatalogIngredient,
  type CatalogLine,
  type CatalogRecipe,
  type CatalogStep,
} from '../../../../src/db/catalog/schema';
export { validateCatalog, type V1IdMap, type V1Ids } from '../../../../src/db/catalog/validate';
export { SEED_RECIPES, type SeedRecipe } from '../../../../src/db/seed/recipes';
export { SEED_INGREDIENTS } from '../../../../src/db/seed/ingredients';
export { RECIPES_EN } from '../../../../src/i18n/content/en';
