CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text,
	`title` text NOT NULL,
	`quantity` real,
	`unit` text,
	`checked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`checked_at` integer,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_items_open_ingredient_uq` ON `shopping_items` (`ingredient_id`) WHERE "shopping_items"."checked" = 0 AND "shopping_items"."ingredient_id" IS NOT NULL;