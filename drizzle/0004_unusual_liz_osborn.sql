CREATE TABLE `render_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
