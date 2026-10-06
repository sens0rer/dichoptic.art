UPDATE "images" SET "credit" = CASE
	WHEN "credit_name" IS NOT NULL AND "credit_url" IS NOT NULL THEN '[' || "credit_name" || '](' || "credit_url" || ')'
	ELSE COALESCE("credit_name", "credit_url") END
WHERE "credit_name" IS NOT NULL OR "credit_url" IS NOT NULL;--> statement-breakpoint
UPDATE "collections" SET "credit" = CASE
	WHEN "credit_name" IS NOT NULL AND "credit_url" IS NOT NULL THEN '[' || "credit_name" || '](' || "credit_url" || ')'
	ELSE COALESCE("credit_name", "credit_url") END
WHERE "credit_name" IS NOT NULL OR "credit_url" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" DROP COLUMN "credit_name";--> statement-breakpoint
ALTER TABLE "collections" DROP COLUMN "credit_url";--> statement-breakpoint
ALTER TABLE "images" DROP COLUMN "credit_name";--> statement-breakpoint
ALTER TABLE "images" DROP COLUMN "credit_url";