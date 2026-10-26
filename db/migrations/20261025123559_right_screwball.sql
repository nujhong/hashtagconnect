-- void:allow-destructive
-- Preserve the old saved/skipped post references before removing cached X content.
CREATE TABLE `post_states` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`choice` text,
	`opened_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`added_at` integer NOT NULL,
	`pooled_at` integer
);
--> statement-breakpoint
CREATE INDEX `posts_pool` ON `posts` (`pooled_at`);--> statement-breakpoint
INSERT INTO posts (id, url, added_at, pooled_at)
SELECT post_id, 'https://x.com/i/web/status/' || post_id, min(discovered_at),
       max(CASE WHEN searchable = 1 THEN discovered_at ELSE NULL END)
FROM candidates WHERE post_id != '' GROUP BY post_id;
--> statement-breakpoint
INSERT INTO post_states (user_id, post_id, choice, opened_at, updated_at)
SELECT d.user_id, c.post_id, d.choice, NULL, d.updated_at
FROM decisions d JOIN candidates c ON c.id = d.candidate_id
WHERE c.post_id != ''
ON CONFLICT(user_id, post_id) DO UPDATE SET
  choice = excluded.choice, updated_at = excluded.updated_at
WHERE excluded.updated_at >= post_states.updated_at;
--> statement-breakpoint
DROP TABLE `candidates`;--> statement-breakpoint
DROP TABLE `decisions`;--> statement-breakpoint
DROP TABLE `read_budget`;--> statement-breakpoint
ALTER TABLE `user` ADD `xUsername` text;--> statement-breakpoint
ALTER TABLE `user` ADD `xAccountId` text;
