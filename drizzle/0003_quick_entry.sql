ALTER TABLE "trades" ADD COLUMN "take_profit" double precision;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "planned_rr" double precision;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "trade_entry_mode" text DEFAULT 'quick' NOT NULL;
