CREATE TYPE "public"."hold_state" AS ENUM('held', 'released', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('topup', 'hold', 'release', 'refund', 'withdraw');--> statement-breakpoint
CREATE TYPE "public"."wallet_owner" AS ENUM('workspace', 'creator', 'escrow', 'platform');--> statement-breakpoint
CREATE TABLE "escrow_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"state" "hold_state" DEFAULT 'held' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "escrow_holds_amount_positive" CHECK ("escrow_holds"."amount_minor" > 0),
	CONSTRAINT "escrow_holds_settled_has_time" CHECK ("escrow_holds"."state" = 'held' or "escrow_holds"."settled_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_group" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"collaboration_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_never_zero" CHECK ("ledger_entries"."amount_minor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "link_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"visitor_hash" text NOT NULL,
	"clicked_on" date NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_clicks_hits_positive" CHECK ("link_clicks"."hits" > 0)
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" "wallet_owner" NOT NULL,
	"workspace_id" uuid,
	"creator_id" uuid,
	"balance_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_owner_matches_column" CHECK (("wallets"."owner" = 'workspace' and "wallets"."workspace_id" is not null and "wallets"."creator_id" is null)
       or ("wallets"."owner" = 'creator' and "wallets"."creator_id" is not null and "wallets"."workspace_id" is null)
       or ("wallets"."owner" in ('escrow', 'platform') and "wallets"."workspace_id" is null and "wallets"."creator_id" is null)),
	CONSTRAINT "wallets_only_platform_goes_negative" CHECK ("wallets"."owner" = 'platform' or "wallets"."balance_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "landing_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_collaboration_id_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."collaborations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_collaboration_id_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."collaborations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_collaboration_id_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."collaborations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "escrow_holds_collab_key" ON "escrow_holds" USING btree ("collaboration_id");--> statement-breakpoint
CREATE INDEX "escrow_holds_open_idx" ON "escrow_holds" USING btree ("state","workspace_id");--> statement-breakpoint
CREATE INDEX "idempotency_keys_user_idx" ON "idempotency_keys" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_group_idx" ON "ledger_entries" USING btree ("entry_group");--> statement-breakpoint
CREATE INDEX "ledger_entries_wallet_idx" ON "ledger_entries" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_group_wallet_key" ON "ledger_entries" USING btree ("entry_group","wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "link_clicks_visitor_day_key" ON "link_clicks" USING btree ("collaboration_id","visitor_hash","clicked_on");--> statement-breakpoint
CREATE INDEX "link_clicks_collab_idx" ON "link_clicks" USING btree ("collaboration_id","clicked_on");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_workspace_key" ON "wallets" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_creator_key" ON "wallets" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_singleton_key" ON "wallets" USING btree ("owner") WHERE "wallets"."owner" in ('escrow', 'platform');