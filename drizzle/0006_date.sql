ALTER TABLE "collections" ADD COLUMN "date" date;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "date" date;--> statement-breakpoint
UPDATE "images" SET "date" = "created_at"::date WHERE "collection_id" IS NULL;--> statement-breakpoint
UPDATE "collections" SET "date" = "created_at"::date;
