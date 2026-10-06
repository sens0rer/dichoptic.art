DELETE FROM "submission_log";--> statement-breakpoint
ALTER TABLE "submission_log" ADD COLUMN "target_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_log" ADD COLUMN "target_id" text NOT NULL;