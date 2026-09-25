CREATE TABLE `product_lookup_cache` (
	`barcode` text PRIMARY KEY NOT NULL,
	`product_json` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_provider_budget` (
	`provider` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`requests` integer NOT NULL,
	`next_at` integer NOT NULL
);
