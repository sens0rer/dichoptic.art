CREATE TYPE "public"."alteration" AS ENUM('unaltered', 'digitally_altered');--> statement-breakpoint
CREATE TYPE "public"."chromacy" AS ENUM('none', 'di', 'tri', 'tetra', 'penta', 'hexa');--> statement-breakpoint
CREATE TYPE "public"."dimension" AS ENUM('2D', '3D');--> statement-breakpoint
CREATE TYPE "public"."medium" AS ENUM('photography', 'art', 'digital_art');--> statement-breakpoint
CREATE TYPE "public"."source_mode" AS ENUM('two_files', 'single_file');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "chromacy_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"chromacy" "chromacy" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_tags" (
	"collection_id" text NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "collection_tags_collection_id_tag_id_pk" PRIMARY KEY("collection_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"credit_name" text,
	"credit_url" text,
	"submitted_by" text,
	"author" text,
	"dimension" "dimension",
	"medium" "medium",
	"alteration" "alteration",
	"chromacy" "chromacy",
	"chromacy_type" text,
	"filter_info" text,
	"cover_image_id" text,
	"owner_id" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED,
	"status" "status" DEFAULT 'approved' NOT NULL,
	"reject_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_tags" (
	"image_id" text NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "image_tags_image_id_tag_id_pk" PRIMARY KEY("image_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"credit_name" text,
	"credit_url" text,
	"submitted_by" text,
	"author" text,
	"dimension" "dimension",
	"medium" "medium",
	"alteration" "alteration",
	"chromacy" "chromacy",
	"chromacy_type" text,
	"filter_info" text,
	"source_mode" "source_mode" NOT NULL,
	"file_key" text,
	"left_key" text,
	"right_key" text,
	"left_w" integer NOT NULL,
	"left_h" integer NOT NULL,
	"right_w" integer,
	"right_h" integer,
	"thumb_prefix" text NOT NULL,
	"thumb_w" integer NOT NULL,
	"thumb_h" integer NOT NULL,
	"phash" bit(64) NOT NULL,
	"collection_id" text,
	"owner_id" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED,
	"status" "status" DEFAULT 'approved' NOT NULL,
	"reject_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"owner_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" text PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "site_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_tags" ADD CONSTRAINT "image_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_search_idx" ON "collections" USING gin ("search");--> statement-breakpoint
CREATE INDEX "collections_owner_id_index" ON "collections" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "images_search_idx" ON "images" USING gin ("search");--> statement-breakpoint
CREATE INDEX "images_collection_id_index" ON "images" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "images_owner_id_index" ON "images" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "images_created_at_index" ON "images" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_unique" ON "likes" USING btree ("owner_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "submission_log_created_at_index" ON "submission_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "submission_log_client_ip_created_at_index" ON "submission_log" USING btree ("client_ip","created_at");