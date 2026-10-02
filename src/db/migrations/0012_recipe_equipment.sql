ALTER TABLE `recipes` ADD `equipment` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `main_protein` text DEFAULT 'other' NOT NULL;