CREATE TABLE `categories` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`comment` text NOT NULL,
	`rating` integer,
	`price` real,
	`currency` text NOT NULL,
	`category_id` text,
	`note_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`owner_id` text NOT NULL,
	`note_id` text NOT NULL,
	`id` text NOT NULL,
	`storage_key` text NOT NULL,
	`sort_order` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`mime_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `note_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`theme` text NOT NULL,
	`default_currency` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`mutation_id` text DEFAULT '' NOT NULL
);
