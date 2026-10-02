CREATE TABLE `catalog_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ingredients` ADD `name_en` text;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `synonyms` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `subcategory` text;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `fat_per_100g` real;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `carbs_per_100g` real;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `source` text DEFAULT 'own' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `source_id` text;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `is_archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `nutrition_edited` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `ingredients_category_idx` ON `ingredients` (`category`);--> statement-breakpoint
CREATE INDEX `ingredients_archived_idx` ON `ingredients` (`is_archived`);--> statement-breakpoint
ALTER TABLE `lidl_products` ADD `brand` text;--> statement-breakpoint
ALTER TABLE `lidl_products` ADD `kcal_per_100g` real;--> statement-breakpoint
ALTER TABLE `lidl_products` ADD `protein_per_100g` real;--> statement-breakpoint
ALTER TABLE `lidl_products` ADD `image_key` text;--> statement-breakpoint
ALTER TABLE `lidl_products` ADD `source` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `lidl_products` ADD `source_id` text;--> statement-breakpoint
ALTER TABLE `lidl_products` ADD `is_archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `recipe_ingredients` ADD `note_en` text;--> statement-breakpoint
ALTER TABLE `recipe_steps` ADD `text_en` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `name_en` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `description_ru` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `description_en` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `cuisine` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `meal_types` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `source` text DEFAULT 'own' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `source_id` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `ingredient_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `kcal_per_serving` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `protein_per_serving` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `protein_density` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `is_archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `recipes_meal_type_idx` ON `recipes` (`meal_type`);--> statement-breakpoint
CREATE INDEX `recipes_archived_idx` ON `recipes` (`is_archived`);--> statement-breakpoint
-- v1 categories → catalog categories (custom products keep their own rows).
UPDATE `ingredients` SET `category` = CASE `category`
  WHEN 'dairy' THEN 'dairy_eggs'
  WHEN 'eggs' THEN 'dairy_eggs'
  WHEN 'meat' THEN 'meat_poultry'
  WHEN 'grains' THEN 'grains_pasta_legumes'
  WHEN 'fruits' THEN 'fruits_berries'
  WHEN 'bread' THEN 'bread_bakery'
  WHEN 'canned' THEN 'other'
  WHEN 'oil' THEN 'sauces_oils_spices'
  WHEN 'spices' THEN 'sauces_oils_spices'
  ELSE `category` END;
