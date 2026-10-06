CREATE TABLE "upload_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_ip" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "upload_log_client_ip_created_at_index" ON "upload_log" USING btree ("client_ip","created_at");