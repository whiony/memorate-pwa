CREATE TABLE `shared_notes` (
	`token` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`note_id` text NOT NULL,
	`public_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_notes_owner_note` ON `shared_notes` (`owner_id`,`note_id`);