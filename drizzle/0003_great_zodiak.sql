CREATE TABLE `material_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `material_presets_owner_created` ON `material_presets` (`owner`,`created_at`);