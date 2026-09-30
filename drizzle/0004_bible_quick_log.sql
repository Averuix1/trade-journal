ALTER TABLE "accounts" ADD COLUMN "is_quick_log" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "former_account" text;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_one_quick_log" ON "accounts" ("is_quick_log") WHERE "is_quick_log";--> statement-breakpoint
CREATE TABLE "bible_state" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "book" text NOT NULL,
  "chapter" integer NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bible_state_singleton" CHECK ("id" = 1)
);--> statement-breakpoint
CREATE TABLE "bible_bookmarks" (
  "id" serial PRIMARY KEY,
  "book" text NOT NULL,
  "chapter" integer NOT NULL,
  "verse" integer,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
INSERT INTO "accounts" ("name", "type", "status", "starting_balance", "start_date", "is_quick_log", "sort_order", "notes")
SELECT 'Quick log', 'PERSONAL', 'ACTIVE', 0, to_char(CURRENT_DATE, 'YYYY-MM-DD'), true, 1000, 'Trades logged without a prop or personal account.'
WHERE NOT EXISTS (SELECT 1 FROM "accounts" WHERE "is_quick_log" = true);
