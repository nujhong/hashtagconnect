-- void:allow-destructive
-- The only dropped table is the unused messages table from the fresh Void starter.
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`bio` text NOT NULL,
	`avatar` text,
	`text` text NOT NULL,
	`posted_at` text NOT NULL,
	`discovered_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`searchable` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `candidates_expiry` ON `candidates` (`expires_at`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`user_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`choice` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `candidate_id`)
);
--> statement-breakpoint
CREATE TABLE `read_budget` (
	`day` text PRIMARY KEY NOT NULL,
	`reserved` integer NOT NULL,
	`next_search_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
DROP TABLE `messages`;
