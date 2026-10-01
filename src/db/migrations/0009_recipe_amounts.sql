CREATE TABLE `recipe_custom_amounts` (
	`recipe_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`amount_per_serving` real NOT NULL,
	PRIMARY KEY(`recipe_id`, `ingredient_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recipe_custom_amount_non_negative" CHECK("recipe_custom_amounts"."amount_per_serving" >= 0)
);
--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `amount_overrides` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `used_amounts` text;