CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`profile_url` text NOT NULL,
	`confirmed_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_profile_url_unique` ON `people` (`profile_url`);--> statement-breakpoint
CREATE TABLE `person_states` (
	`user_id` text NOT NULL,
	`person_id` text NOT NULL,
	`source_post_id` text,
	`choice` text,
	`opened_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `person_id`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `person_id` text REFERENCES people(id);