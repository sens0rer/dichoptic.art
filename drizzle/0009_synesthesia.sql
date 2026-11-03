CREATE TABLE "syn_answers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"attempt_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"start" integer,
	"end" integer,
	"colour" jsonb,
	"note" text,
	"supersedes" text,
	"answered_at" timestamp with time zone NOT NULL,
	"tz" text,
	"shown_ms" integer,
	"since_prev_ms" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "syn_answers_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "syn_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"stimulus_id" text NOT NULL,
	"retest" boolean DEFAULT false NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syn_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"position" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syn_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"device" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syn_stimuli" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"lang" text,
	"title" text,
	"body" text NOT NULL,
	"source" jsonb,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "syn_answers" ADD CONSTRAINT "syn_answers_attempt_id_syn_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."syn_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syn_answers" ADD CONSTRAINT "syn_answers_participant_id_syn_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."syn_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syn_attempts" ADD CONSTRAINT "syn_attempts_participant_id_syn_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."syn_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syn_attempts" ADD CONSTRAINT "syn_attempts_stimulus_id_syn_stimuli_id_fk" FOREIGN KEY ("stimulus_id") REFERENCES "public"."syn_stimuli"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syn_sessions" ADD CONSTRAINT "syn_sessions_participant_id_syn_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."syn_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "syn_answers_attempt_id_index" ON "syn_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "syn_attempts_participant_id_stimulus_id_index" ON "syn_attempts" USING btree ("participant_id","stimulus_id");--> statement-breakpoint
CREATE INDEX "syn_stimuli_category_index" ON "syn_stimuli" USING btree ("category");