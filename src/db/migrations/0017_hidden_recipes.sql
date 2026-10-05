CREATE TABLE `hidden_recipes` (
	`recipe_id` text PRIMARY KEY NOT NULL,
	`hidden_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
