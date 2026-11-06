ALTER TABLE `users` ADD `profile_type` text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarded_at` integer;