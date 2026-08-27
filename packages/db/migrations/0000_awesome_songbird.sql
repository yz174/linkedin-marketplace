CREATE TYPE "public"."account_type" AS ENUM('brand', 'creator');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."sector" AS ENUM('DevTools', 'RevOps', 'MarTech', 'FinTech', 'HR Tech', 'Recruiting', 'Sales', 'Cybersecurity', 'Data and AI', 'B2B SaaS', 'E-commerce', 'Manufacturing', 'Logistics', 'Healthcare', 'Legal', 'Real Estate', 'Education', 'Design', 'Fashion', 'Hospitality', 'Gaming', 'Sustainability', 'Consulting', 'Hardware');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"product_url" text NOT NULL,
	"icp_summary" text NOT NULL,
	"icp_points" jsonb NOT NULL,
	"buyer_titles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sectors" "sector"[] NOT NULL,
	"icp_embedding" vector(768),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_sectors_len" CHECK (cardinality("brands"."sectors") between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contributor_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "creators_contributor_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 100 CACHE 1),
	"profile_url" text NOT NULL,
	"name" text NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"photo_url" text,
	"topics" "sector"[] NOT NULL,
	"rate_per_post_minor" bigint NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"engagement_rate" real DEFAULT 0 NOT NULL,
	"posts_per_week" real DEFAULT 0 NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"open_slots" integer DEFAULT 2 NOT NULL,
	"fingerprint_embedding" vector(768),
	"listed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creators_topics_len" CHECK (cardinality("creators"."topics") between 1 and 3),
	CONSTRAINT "creators_rate_nonneg" CHECK ("creators"."rate_per_post_minor" >= 0),
	CONSTRAINT "creators_delivered_lte_accepted" CHECK ("creators"."delivered_count" <= "creators"."accepted_count")
);
--> statement-breakpoint
CREATE TABLE "linkedin_profile_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_url" text NOT NULL,
	"provider" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"account_type" "account_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_workspace_key" ON "brands" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_user_key" ON "creators" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_profile_url_key" ON "creators" USING btree ("profile_url");--> statement-breakpoint
CREATE INDEX "creators_topics_idx" ON "creators" USING gin ("topics");--> statement-breakpoint
CREATE INDEX "linkedin_snapshots_url_idx" ON "linkedin_profile_snapshots" USING btree ("profile_url","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_key" ON "workspace_members" USING btree ("workspace_id","user_id");