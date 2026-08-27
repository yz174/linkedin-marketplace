CREATE TYPE "public"."actor_kind" AS ENUM('brand', 'creator', 'system');--> statement-breakpoint
CREATE TYPE "public"."campaign_source" AS ENUM('ai', 'url', 'document');--> statement-breakpoint
CREATE TYPE "public"."collab_event" AS ENUM('accept', 'decline', 'counter', 'expire', 'share_brief', 'submit_draft', 'approve', 'request_revision', 'schedule', 'publish', 'verify', 'pay', 'cancel');--> statement-breakpoint
CREATE TYPE "public"."collab_state" AS ENUM('invited', 'countered', 'accepted', 'brief_shared', 'draft_submitted', 'revision_requested', 'draft_approved', 'scheduled', 'published', 'verified', 'paid', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"title" text NOT NULL,
	"objective" text NOT NULL,
	"key_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"do_not" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deliverable" text NOT NULL,
	"budget_min_minor" bigint NOT NULL,
	"budget_max_minor" bigint NOT NULL,
	"source" "campaign_source" NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_budget_order" CHECK ("campaigns"."budget_min_minor" <= "campaigns"."budget_max_minor")
);
--> statement-breakpoint
CREATE TABLE "collaboration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"event" "collab_event" NOT NULL,
	"actor" "actor_kind" NOT NULL,
	"actor_user_id" text,
	"from_state" "collab_state" NOT NULL,
	"to_state" "collab_state" NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"state" "collab_state" DEFAULT 'invited' NOT NULL,
	"fee_minor" bigint NOT NULL,
	"counter_fee_minor" bigint,
	"counter_rounds" integer DEFAULT 0 NOT NULL,
	"tracked_link" text,
	"post_url" text,
	"draft" text,
	"publish_by" timestamp with time zone,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaborations_fee_nonneg" CHECK ("collaborations"."fee_minor" >= 0),
	CONSTRAINT "collaborations_rounds_capped" CHECK ("collaborations"."counter_rounds" between 0 and 3),
	CONSTRAINT "collaborations_published_needs_link" CHECK ("collaborations"."state" not in ('published', 'verified', 'paid') or "collaborations"."tracked_link" is not null)
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_events" ADD CONSTRAINT "collaboration_events_collaboration_id_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."collaborations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_events" ADD CONSTRAINT "collaboration_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_brand_idx" ON "campaigns" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "collaboration_events_collab_idx" ON "collaboration_events" USING btree ("collaboration_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborations_reference_key" ON "collaborations" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborations_campaign_creator_key" ON "collaborations" USING btree ("campaign_id","creator_id");--> statement-breakpoint
CREATE INDEX "collaborations_creator_idx" ON "collaborations" USING btree ("creator_id","state");