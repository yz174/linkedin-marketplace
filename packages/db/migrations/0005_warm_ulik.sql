ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_wallet_id_wallets_id_fk";
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;