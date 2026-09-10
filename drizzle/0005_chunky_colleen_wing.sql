CREATE TABLE `hermes_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hermes_jobs` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`connection_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`run_id` text,
	`status` text NOT NULL,
	`output` text,
	`created_at` integer NOT NULL,
	`deadline` integer NOT NULL,
	`purpose` text NOT NULL,
	`cancel_requested` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE INDEX `hermes_jobs_owner_created` ON `hermes_jobs` (`owner`,`created_at`);