CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cook_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`servings` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`undone_at` integer,
	`pantry_delta` text,
	`shortfall` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_hu` text,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`grams_per_piece` real,
	`kcal_per_100g` real NOT NULL,
	`protein_per_100g` real NOT NULL,
	`is_staple` integer DEFAULT false NOT NULL,
	`image_key` text,
	`is_custom` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lidl_products` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`title` text NOT NULL,
	`package_size` real NOT NULL,
	`package_unit` text NOT NULL,
	`price_huf` integer,
	`on_sale` integer DEFAULT false NOT NULL,
	`sale_until` text,
	`barcode` text,
	`notes` text,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lidl_products_barcode_unique` ON `lidl_products` (`barcode`);--> statement-breakpoint
CREATE INDEX `lidl_products_ingredient_idx` ON `lidl_products` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`local_date` text NOT NULL,
	`meal_type` text NOT NULL,
	`source` text NOT NULL,
	`recipe_id` text,
	`name` text NOT NULL,
	`kcal` integer NOT NULL,
	`protein` real NOT NULL,
	`servings` real DEFAULT 1 NOT NULL,
	`cook_session_id` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cook_session_id`) REFERENCES `cook_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meal_logs_local_date_idx` ON `meal_logs` (`local_date`);--> statement-breakpoint
CREATE INDEX `meal_logs_cook_session_idx` ON `meal_logs` (`cook_session_id`);--> statement-breakpoint
CREATE TABLE `pantry_items` (
	`ingredient_id` text PRIMARY KEY NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "pantry_quantity_non_negative" CHECK("pantry_items"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE `prepared_portions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`cook_session_id` text,
	`portions_left` integer NOT NULL,
	`kcal_per_portion` integer NOT NULL,
	`protein_per_portion` real NOT NULL,
	`cooked_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cook_session_id`) REFERENCES `cook_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "portions_left_non_negative" CHECK("prepared_portions"."portions_left" >= 0)
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`sex` text NOT NULL,
	`age` integer NOT NULL,
	`height_cm` real NOT NULL,
	`weight_kg` real NOT NULL,
	`activity_level` text NOT NULL,
	`goal_rate_kg_per_week` real NOT NULL,
	`kcal_target` integer NOT NULL,
	`protein_target_g` integer NOT NULL,
	`protein_min_g` integer NOT NULL,
	`target_overridden` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "profile_single_row" CHECK("profile"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`recipe_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`amount_per_serving` real NOT NULL,
	`unit` text NOT NULL,
	`optional` integer DEFAULT false NOT NULL,
	`alt_group` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`note` text,
	PRIMARY KEY(`recipe_id`, `ingredient_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_ingredient_idx` ON `recipe_ingredients` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `recipe_steps` (
	`recipe_id` text NOT NULL,
	`step_order` integer NOT NULL,
	`text` text NOT NULL,
	`timer_sec` integer,
	`ingredient_refs` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`recipe_id`, `step_order`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`meal_type` text NOT NULL,
	`default_servings` integer DEFAULT 1 NOT NULL,
	`is_batch` integer DEFAULT false NOT NULL,
	`prep_night_before` integer DEFAULT false NOT NULL,
	`total_minutes` integer NOT NULL,
	`image_key` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weight_logs` (
	`local_date` text PRIMARY KEY NOT NULL,
	`weight_kg` real NOT NULL
);
