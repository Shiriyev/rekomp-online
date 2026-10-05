ALTER TABLE `prepared_portions` ADD `storage_days` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `storage_days` integer DEFAULT 3 NOT NULL;