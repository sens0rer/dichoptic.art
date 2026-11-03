CREATE TABLE "syn_result_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"stimulus_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syn_reverse" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"session_id" text NOT NULL,
	"colour" jsonb NOT NULL,
	"text" text,
	"nothing" boolean DEFAULT false NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	"tz" text,
	"shown_ms" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "syn_reverse_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "syn_result_views" ADD CONSTRAINT "syn_result_views_participant_id_syn_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."syn_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syn_result_views" ADD CONSTRAINT "syn_result_views_stimulus_id_syn_stimuli_id_fk" FOREIGN KEY ("stimulus_id") REFERENCES "public"."syn_stimuli"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syn_reverse" ADD CONSTRAINT "syn_reverse_participant_id_syn_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."syn_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "syn_result_views_participant_id_stimulus_id_index" ON "syn_result_views" USING btree ("participant_id","stimulus_id");--> statement-breakpoint
CREATE INDEX "syn_reverse_participant_id_index" ON "syn_reverse" USING btree ("participant_id");