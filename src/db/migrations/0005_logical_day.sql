PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_profile` (
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
	`day_start_hour` integer DEFAULT 4 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "profile_single_row" CHECK("__new_profile"."id" = 1),
	CONSTRAINT "profile_day_start_hour_range" CHECK("__new_profile"."day_start_hour" BETWEEN 0 AND 6)
);
--> statement-breakpoint
INSERT INTO `__new_profile`("id", "sex", "age", "height_cm", "weight_kg", "activity_level", "goal_rate_kg_per_week", "kcal_target", "protein_target_g", "protein_min_g", "target_overridden", "day_start_hour", "updated_at") SELECT "id", "sex", "age", "height_cm", "weight_kg", "activity_level", "goal_rate_kg_per_week", "kcal_target", "protein_target_g", "protein_min_g", "target_overridden", 4, "updated_at" FROM `profile`;--> statement-breakpoint
DROP TABLE `profile`;--> statement-breakpoint
ALTER TABLE `__new_profile` RENAME TO `profile`;--> statement-breakpoint
PRAGMA foreign_keys=ON;