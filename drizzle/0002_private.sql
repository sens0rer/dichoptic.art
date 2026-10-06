ALTER TABLE "collections" ADD COLUMN "private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "private" boolean DEFAULT false NOT NULL;