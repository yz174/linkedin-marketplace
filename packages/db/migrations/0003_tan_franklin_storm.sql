CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"sender" "actor_kind" NOT NULL,
	"sender_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_seq_positive" CHECK ("messages"."seq" > 0),
	CONSTRAINT "messages_body_length" CHECK (char_length("messages"."body") between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "collaborations" ADD COLUMN "message_seq" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_collaboration_id_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."collaborations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_collab_seq_key" ON "messages" USING btree ("collaboration_id","seq");--> statement-breakpoint
CREATE INDEX "messages_collab_seq_idx" ON "messages" USING btree ("collaboration_id","seq");