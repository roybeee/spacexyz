CREATE TABLE `assemblies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`note` text NOT NULL,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`count` integer NOT NULL,
	`width` real NOT NULL,
	`depth` real NOT NULL,
	`height` real NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assemblies_owner_created` ON `assemblies` (`owner`,`created_at`);