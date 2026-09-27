ALTER TABLE `cook_sessions` ADD `abandoned_at` integer;--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `choices` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `progress` text;