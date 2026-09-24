CREATE TABLE `photo_objects` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`storage_key` text NOT NULL,
	`sha256` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
