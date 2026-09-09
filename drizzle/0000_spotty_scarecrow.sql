CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_owner` ON `photos` (`owner`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`scene` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner_updated` ON `projects` (`owner`,`updated_at`);