CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"stage" text,
	"firm" text,
	"program" text,
	"account_size" double precision,
	"starting_balance" double precision DEFAULT 0 NOT NULL,
	"target_balance" double precision,
	"target_date" text,
	"start_date" text NOT NULL,
	"profit_target" double precision,
	"max_drawdown" double precision,
	"drawdown_type" text,
	"daily_loss_limit" double precision,
	"consistency_pct" double precision,
	"min_trading_days" integer,
	"max_trades_per_session" integer DEFAULT 3 NOT NULL,
	"risk_per_trade" double precision DEFAULT 300 NOT NULL,
	"active_sessions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entry_windows" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reset_of_account_id" integer,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_journals" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"date" text NOT NULL,
	"mood" integer,
	"sleep_hours" double precision,
	"grade" text,
	"followed_plan" boolean,
	"lesson" text,
	"notes" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"sat_out" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"source" text NOT NULL,
	"file_name" text,
	"trade_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"point_value" double precision NOT NULL,
	"tick_size" double precision DEFAULT 0.25 NOT NULL,
	"commission_per_contract" double precision DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"date" text NOT NULL,
	"kind" text NOT NULL,
	"amount" double precision NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mistake_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbook_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"playbook_id" integer NOT NULL,
	"text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"colour" text DEFAULT '#22d39a' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer,
	"account_id" integer NOT NULL,
	"trade_date" text NOT NULL,
	"url" text,
	"blob_path" text,
	"data" "bytea",
	"content_type" text DEFAULT 'image/png' NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_defs" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"entry_window_mins" integer DEFAULT 30 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'Australia/Sydney' NOT NULL,
	"be_band_r" double precision DEFAULT 0.09 NOT NULL,
	"last_symbol" text,
	"last_account_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"trade_date" text NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"contracts" double precision DEFAULT 1 NOT NULL,
	"entry_price" double precision,
	"stop_price" double precision,
	"exit_price" double precision,
	"fees" double precision DEFAULT 0 NOT NULL,
	"fees_overridden" boolean DEFAULT false NOT NULL,
	"pnl" double precision DEFAULT 0 NOT NULL,
	"pnl_overridden" boolean DEFAULT false NOT NULL,
	"r_multiple" double precision,
	"session_key" text,
	"slot" text,
	"playbook_id" integer,
	"broken_rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"followed_rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mistake_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"breaks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"in_system" boolean DEFAULT true NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"notes" text,
	"import_id" integer,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "day_journals_uq" ON "day_journals" USING btree ("account_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "trades_external_uq" ON "trades" USING btree ("account_id","external_id");